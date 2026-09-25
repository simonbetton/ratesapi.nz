import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { D1RunOptions, D1Target } from "../bin/utils";
import { saveToD1 } from "../bin/utils";
import { fromSavableJson, toSavableJson } from "../src/lib/data-loader";
import type { MortgageRates } from "../src/models/mortgage-rates";

// This suite spawns the real, installed Wrangler binary against a throwaway
// local D1 database (via --local --persist-to <temp dir>). It never touches
// the repository's configured production/local database and never passes
// --remote. It is opt-in because each Wrangler invocation takes several
// seconds and the suite must never run as part of the default `bun test` or
// the pre-commit hook.
const RUN_INTEGRATION = process.env.RUN_D1_LOCAL_TESTS === "1";

const TEST_TIMEOUT_MS = 60_000;

// `npx` resolves the locally installed `wrangler` binary relative to the
// current working directory. It lives in apps/api/node_modules/.bin, not
// the repo root, so spawn it with apps/api as cwd (matching how the real
// scraper scripts are always run via `bun run --cwd apps/api`).
const apiDir = fileURLToPath(new URL("..", import.meta.url));

function expectSingleRow(
  rows: Record<string, unknown>[]
): Record<string, unknown> {
  expect(rows).toHaveLength(1);
  const [row] = rows;
  if (!row) {
    throw new Error("expected exactly one row");
  }
  return row;
}

function sampleData(overrides: Partial<MortgageRates> = {}): MortgageRates {
  return {
    type: "MortgageRates",
    data: [
      {
        id: "institution:anz",
        name: "ANZ",
        products: [{ id: "product:anz:standard", name: "Standard", rates: [] }],
      },
    ],
    lastUpdated: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function fixedNow(iso: string): () => Date {
  return () => new Date(iso);
}

describe.skipIf(!RUN_INTEGRATION)("saveToD1 local D1 integration", () => {
  const databaseName = "d1-persistence-integration-test";
  const databaseId = "00000000-0000-0000-0000-000000000000";
  const target: D1Target = { databaseName, flags: [] };

  let tempDir: string;
  let persistDir: string;
  let configPath: string;

  function execLocal(args: string[]): string {
    // Strip any credentials/remote-targeting env vars so this can never
    // accidentally resolve to a real or remote D1 database.
    const sanitizedEnv = { ...process.env };
    delete sanitizedEnv.D1_REMOTE;
    delete sanitizedEnv.D1_DATABASE_NAME;
    delete sanitizedEnv.CLOUDFLARE_API_TOKEN;
    delete sanitizedEnv.CLOUDFLARE_ACCOUNT_ID;

    return execFileSync(
      "npx",
      [
        "wrangler",
        "d1",
        "execute",
        databaseName,
        "--config",
        configPath,
        "--local",
        "--persist-to",
        persistDir,
        ...args,
      ],
      {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        env: sanitizedEnv,
        cwd: apiDir,
      }
    );
  }

  function run(
    _target: D1Target,
    command: string,
    options: D1RunOptions = {}
  ): string {
    return execLocal([
      "--command",
      command,
      ...(options.json ? ["--json"] : []),
    ]);
  }

  function queryRows(sql: string): Record<string, unknown>[] {
    const output = execLocal(["--command", sql, "--json"]);
    const parsed: unknown = JSON.parse(output);
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    const rows: Record<string, unknown>[] = [];

    for (const entry of entries) {
      if (typeof entry !== "object" || entry === null) {
        continue;
      }
      const record = entry as Record<string, unknown>;
      const resultRows = record.results ?? record.result;
      if (Array.isArray(resultRows)) {
        rows.push(...(resultRows as Record<string, unknown>[]));
      }
    }

    return rows;
  }

  beforeAll(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "ratesapi-d1-test-"));
    persistDir = path.join(tempDir, "persist");
    configPath = path.join(tempDir, "wrangler.toml");

    writeFileSync(
      configPath,
      [
        `name = "${databaseName}"`,
        'compatibility_date = "2025-06-01"',
        "",
        "[[d1_databases]]",
        'binding = "DATABASE"',
        `database_name = "${databaseName}"`,
        `database_id = "${databaseId}"`,
        "",
      ].join("\n")
    );

    const schemaPath = fileURLToPath(new URL("../schema.sql", import.meta.url));
    execLocal(["--file", schemaPath]);
  }, TEST_TIMEOUT_MS);

  afterAll(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test(
    "writes the same encoded payload to both tables on success",
    async () => {
      const dataType = "mortgage-rates";
      const data = sampleData({ lastUpdated: "2026-01-15T00:00:00.000Z" });
      const expectedEncoded = toSavableJson(data);

      const result = await saveToD1(data, dataType, {
        target,
        run,
        now: () => new Date("2026-01-15T00:00:00.000Z"),
      });

      expect(result).toBe(true);

      const historyRow = expectSingleRow(
        queryRows(
          `SELECT data FROM historical_data WHERE data_type='${dataType}' AND date='2026-01-15'`
        )
      );
      const latestRow = expectSingleRow(
        queryRows(`SELECT data FROM latest_data WHERE data_type='${dataType}'`)
      );

      expect(historyRow.data).toBe(expectedEncoded);
      expect(latestRow.data).toBe(expectedEncoded);
    },
    TEST_TIMEOUT_MS
  );

  test(
    "rolls back both mutations, leaving prior rows byte-for-byte unchanged, when the second statement is forced to fail",
    async () => {
      const dataType = "car-loan-rates";
      const oldData = sampleData({
        data: [
          {
            id: "institution:anz",
            name: "ANZ (old)",
            products: [
              { id: "product:anz:standard", name: "Standard", rates: [] },
            ],
          },
        ],
        lastUpdated: "2020-01-01T00:00:00.000Z",
      });
      const oldEncoded = toSavableJson(oldData);

      // Seed pre-existing rows directly, bypassing saveToD1.
      execLocal([
        "--command",
        [
          `INSERT INTO historical_data (data_type, date, data) VALUES ('${dataType}', '2020-01-01', '${oldEncoded}')`,
          `INSERT INTO latest_data (data_type, data, last_updated) VALUES ('${dataType}', '${oldEncoded}', '2020-01-01 00:00:00')`,
        ].join("; "),
      ]);

      const triggerName = "fail_latest_car_loan";
      execLocal([
        "--command",
        `CREATE TRIGGER ${triggerName} BEFORE INSERT ON latest_data WHEN NEW.data_type = '${dataType}' BEGIN SELECT RAISE(ABORT, 'forced failure'); END`,
      ]);

      try {
        const newData = sampleData({
          data: [
            {
              id: "institution:anz",
              name: "ANZ (new)",
              products: [
                { id: "product:anz:standard", name: "Standard", rates: [] },
              ],
            },
          ],
          lastUpdated: "2020-01-01T00:00:00.000Z",
        });

        const result = await saveToD1(newData, dataType, {
          target,
          run,
          now: () => new Date("2020-01-01T00:00:00.000Z"),
        });

        expect(result).toBe(false);

        const historyRow = expectSingleRow(
          queryRows(
            `SELECT data FROM historical_data WHERE data_type='${dataType}' AND date='2020-01-01'`
          )
        );
        const latestRow = expectSingleRow(
          queryRows(
            `SELECT data FROM latest_data WHERE data_type='${dataType}'`
          )
        );

        expect(historyRow.data).toBe(oldEncoded);
        expect(latestRow.data).toBe(oldEncoded);
      } finally {
        execLocal(["--command", `DROP TRIGGER ${triggerName}`]);
      }
    },
    TEST_TIMEOUT_MS
  );

  test(
    "two saves on the same day leave one historical_data row holding the second payload",
    async () => {
      const dataType = "personal-loan-rates";
      const now = fixedNow("2026-02-01T00:00:00.000Z");

      const first = sampleData({
        data: [
          {
            id: "institution:anz",
            name: "ANZ v1",
            products: [
              { id: "product:anz:standard", name: "Standard", rates: [] },
            ],
          },
        ],
        lastUpdated: "2026-02-01T00:00:00.000Z",
      });
      const second = sampleData({
        data: [
          {
            id: "institution:anz",
            name: "ANZ v2",
            products: [
              { id: "product:anz:standard", name: "Standard", rates: [] },
            ],
          },
        ],
        lastUpdated: "2026-02-01T12:00:00.000Z",
      });

      const firstResult = await saveToD1(first, dataType, {
        target,
        run,
        now,
      });
      expect(firstResult).toBe(true);

      const secondResult = await saveToD1(second, dataType, {
        target,
        run,
        now,
      });
      expect(secondResult).toBe(true);

      const historyRow = expectSingleRow(
        queryRows(
          `SELECT data FROM historical_data WHERE data_type='${dataType}' AND date='2026-02-01'`
        )
      );

      expect(historyRow.data).toBe(toSavableJson(second));
    },
    TEST_TIMEOUT_MS
  );

  test(
    "a Unicode payload round-trips through the stored row",
    async () => {
      const dataType = "credit-card-rates";
      const data = sampleData({
        data: [
          {
            id: "institution:kiwibank",
            name: "Kāinga Ora — “preferred” rate 🏠",
            products: [
              { id: "product:kiwibank:standard", name: "Standard", rates: [] },
            ],
          },
        ],
        lastUpdated: "2026-03-03T00:00:00.000Z",
      });

      const result = await saveToD1(data, dataType, {
        target,
        run,
        now: () => new Date("2026-03-03T00:00:00.000Z"),
      });

      expect(result).toBe(true);

      const latestRow = expectSingleRow(
        queryRows(`SELECT data FROM latest_data WHERE data_type='${dataType}'`)
      );

      expect(typeof latestRow.data).toBe("string");
      expect(fromSavableJson(latestRow.data as string)).toEqual(data);
    },
    TEST_TIMEOUT_MS
  );
});
