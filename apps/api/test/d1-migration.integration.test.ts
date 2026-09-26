import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { migrateD1 } from "../bin/migrate-d1";
import type { D1RunOptions, D1Target } from "../bin/utils";
import { extractWranglerRows, markCheckedInD1, saveToD1 } from "../bin/utils";
import { toSavableJson } from "../src/lib/data-loader";
import type { MortgageRates } from "../src/models/mortgage-rates";

// Like d1-persistence.integration.test.ts, this suite spawns the real
// Wrangler binary against throwaway local D1 databases (--local
// --persist-to <temp dir>). It never passes --remote, and it only runs when
// RUN_D1_LOCAL_TESTS=1.
const RUN_INTEGRATION = process.env.RUN_D1_LOCAL_TESTS === "1";

const TEST_TIMEOUT_MS = 60_000;

const apiDir = fileURLToPath(new URL("..", import.meta.url));
const schemaPath = fileURLToPath(new URL("../schema.sql", import.meta.url));

// latest_data as schema.sql created it before last_checked existed.
const oldSchema = `
CREATE TABLE IF NOT EXISTS historical_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data_type TEXT NOT NULL,
  date TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(data_type, date)
);
CREATE TABLE IF NOT EXISTS latest_data (
  data_type TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

const d1Timestamp = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u;

function sampleData(name: string): MortgageRates {
  return {
    type: "MortgageRates",
    data: [
      {
        id: "institution:anz",
        name,
        products: [{ id: "product:anz:standard", name: "Standard", rates: [] }],
      },
    ],
    lastUpdated: "2026-01-01T00:00:00.000Z",
  };
}

describe.skipIf(!RUN_INTEGRATION)("migrateD1 local D1 integration", () => {
  const databaseName = "d1-migration-integration-test";
  const databaseId = "00000000-0000-0000-0000-000000000002";
  const target: D1Target = { databaseName, flags: [] };

  let tempDir: string;
  let configPath: string;

  function execLocal(persistDir: string, args: string[]): string {
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

  function database(name: string, schemaFile: string) {
    const persistDir = path.join(tempDir, name);
    execLocal(persistDir, ["--file", schemaFile]);

    return {
      run(_target: D1Target, command: string, options: D1RunOptions = {}) {
        return execLocal(persistDir, [
          "--command",
          command,
          ...(options.json ? ["--json"] : []),
        ]);
      },
      query(sql: string) {
        return extractWranglerRows(
          execLocal(persistDir, ["--command", sql, "--json"])
        );
      },
    };
  }

  beforeAll(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "ratesapi-d1-migration-test-"));
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
    writeFileSync(path.join(tempDir, "old-schema.sql"), oldSchema);
  });

  afterAll(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test(
    "keeps scrapes working before the migration, then adds the column once and keeps the rows",
    async () => {
      const db = database("old", path.join(tempDir, "old-schema.sql"));
      const dataType = "mortgage-rates";

      // Before the migration: a save still works and a check is only a warning.
      await expect(
        saveToD1(sampleData("ANZ v1"), dataType, { target, run: db.run })
      ).resolves.toBe(true);
      await expect(
        markCheckedInD1(dataType, { target, run: db.run })
      ).resolves.toBe(false);
      const [before] = db.query(
        `SELECT data, last_updated FROM latest_data WHERE data_type='${dataType}'`
      );
      expect(before?.data).toBe(toSavableJson(sampleData("ANZ v1")));

      expect(migrateD1({ target, run: db.run })).toBe("added");
      expect(migrateD1({ target, run: db.run })).toBe("already-present");

      const [migrated] = db.query(
        `SELECT data, last_updated, last_checked FROM latest_data WHERE data_type='${dataType}'`
      );
      expect(migrated).toEqual({ ...before, last_checked: null });

      // After the migration: an unchanged scrape records only the check.
      await expect(
        markCheckedInD1(dataType, { target, run: db.run })
      ).resolves.toBe(true);
      const [checked] = db.query(
        `SELECT data, last_updated, last_checked FROM latest_data WHERE data_type='${dataType}'`
      );
      expect(checked?.data).toBe(before?.data);
      expect(checked?.last_updated).toBe(before?.last_updated);
      expect(checked?.last_checked).toMatch(d1Timestamp);

      // A changed scrape records both times in one batch.
      await expect(
        saveToD1(sampleData("ANZ v2"), dataType, { target, run: db.run })
      ).resolves.toBe(true);
      const [saved] = db.query(
        `SELECT last_updated, last_checked FROM latest_data WHERE data_type='${dataType}'`
      );
      expect(saved?.last_checked).toMatch(d1Timestamp);
      expect(saved?.last_checked).toBe(saved?.last_updated);
    },
    TEST_TIMEOUT_MS
  );

  test(
    "changes nothing in a database made from the current schema.sql",
    () => {
      const db = database("current", schemaPath);

      expect(migrateD1({ target, run: db.run })).toBe("already-present");
    },
    TEST_TIMEOUT_MS
  );
});
