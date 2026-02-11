/* eslint-disable no-console */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import ora from "ora";

import { createConvexClient } from "../src/lib/convex-client";
import { CONVEX_FUNCTIONS } from "../src/lib/convex-functions";
import { type DataType, modelTypeForDataType } from "../src/lib/data-types";
import { hashJson } from "../src/lib/hash";
import {
  computeDailyAggregate,
  type DailyAggregate,
} from "../src/lib/rate-aggregates";
import { parseModelByDataType } from "../src/lib/rates-models";
import type { CarLoanRates } from "../src/models/car-loan-rates";
import type { CreditCardRates } from "../src/models/credit-card-rates";
import type { MortgageRates } from "../src/models/mortgage-rates";
import type { PersonalLoanRates } from "../src/models/personal-loan-rates";

type SupportedModels =
  | MortgageRates
  | PersonalLoanRates
  | CarLoanRates
  | CreditCardRates;

type D1Row = {
  data?: string;
  data_type?: string;
  date?: string;
  last_updated?: string;
};

type D1ResultEnvelope = {
  results?: D1Row[];
};

type CliOptions =
  | {
      historicalPath: string;
      latestPath?: string;
      mode: "files";
    }
  | {
      database: string;
      mode: "d1";
      remote: boolean;
    };

const WRANGLER_MAX_BUFFER_BYTES = 256 * 1024 * 1024;
const DEFAULT_D1_PAGE_SIZE = 200;

const d1PageSize = readPositiveInteger(
  process.env.D1_MIGRATION_PAGE_SIZE,
  DEFAULT_D1_PAGE_SIZE,
);

const ingestSecret = process.env.CONVEX_INGEST_SECRET;

if (!process.env.CONVEX_URL) {
  console.error("CONVEX_URL is required");
  process.exit(1);
}

if (!ingestSecret) {
  console.error("CONVEX_INGEST_SECRET is required");
  process.exit(1);
}

const options = parseCliOptions(process.argv.slice(2));
const sourceRows = loadRows(options);

const ingestRows = sourceRows.sort((left, right) => {
  const leftDate = left.date ?? "";
  const rightDate = right.date ?? "";

  if (leftDate !== rightDate) {
    return leftDate.localeCompare(rightDate);
  }

  return (left.last_updated ?? "").localeCompare(right.last_updated ?? "");
});

const client = createConvexClient();

const run = async () => {
  const sourceLabel =
    options.mode === "d1"
      ? `Cloudflare D1 (${options.remote ? "remote" : "local"})`
      : "D1 export files";
  const spinner = ora(
    `Migrating ${ingestRows.length} snapshots from ${sourceLabel} into Convex`,
  ).start();

  let imported = 0;
  let skipped = 0;

  for (const row of ingestRows) {
    try {
      const dataType = parseDataType(row.data_type);

      if (!dataType || !row.data) {
        skipped += 1;
        continue;
      }

      const decodedPayload = decodeLegacyPayload(row.data);
      const validatedPayload = validatePayload(dataType, decodedPayload);
      const snapshotDate =
        row.date ??
        toDateString(readSourceLastUpdated(validatedPayload, row.last_updated));
      const scrapedAt = readSourceLastUpdated(validatedPayload, row.last_updated);
      const aggregate: DailyAggregate = computeDailyAggregate(
        dataType,
        validatedPayload,
        scrapedAt,
      );

      await client.mutation(CONVEX_FUNCTIONS.upsertSnapshot, {
        aggregate,
        dataType,
        ingestSecret,
        modelType: modelTypeForDataType(dataType),
        payload: validatedPayload,
        payloadHash: hashJson(validatedPayload),
        recordCount: aggregate.totals.ratePoints,
        scrapedAt,
        snapshotDate,
        sourceLastUpdated: scrapedAt,
      });

      imported += 1;
    } catch (error) {
      skipped += 1;
      console.error("Skipping row due to migration error:", error);
    }
  }

  spinner.succeed(
    `Migration complete. Imported ${imported} snapshots, skipped ${skipped}.`,
  );
};

run().catch((error) => {
  console.error("Migration failed", error);
  process.exit(1);
});

function parseCliOptions(args: string[]): CliOptions {
  let databaseArg: string | undefined;
  let remote = true;
  const positional: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (!token) {
      continue;
    }

    if (token === "--d1") {
      const database = args[index + 1];

      if (!database) {
        failWithUsage("Missing value after --d1");
      }

      databaseArg = database;
      index += 1;
      continue;
    }

    if (token === "--remote") {
      remote = true;
      continue;
    }

    if (token === "--local") {
      remote = false;
      continue;
    }

    if (token.startsWith("--")) {
      failWithUsage(`Unknown option: ${token}`);
    }

    positional.push(token);
  }

  if (positional.length > 0) {
    if (databaseArg) {
      failWithUsage("Use either --d1 mode or file arguments, not both");
    }

    const historicalPath = resolve(process.cwd(), positional[0] ?? "");
    const latestPathArg = positional[1];
    const latestPath = latestPathArg
      ? resolve(process.cwd(), latestPathArg)
      : undefined;

    return {
      historicalPath,
      latestPath,
      mode: "files",
    };
  }

  const envDatabase =
    process.env.CLOUDFLARE_D1_DATABASE ??
    process.env.D1_DATABASE_NAME ??
    process.env.CLOUDFLARE_D1_DATABASE_ID;
  const database = databaseArg ?? envDatabase;

  if (!database) {
    failWithUsage(
      "No D1 database configured. Set CLOUDFLARE_D1_DATABASE or pass --d1 <database>",
    );
  }

  return {
    database,
    mode: "d1",
    remote,
  };
}

function loadRows(options: CliOptions): D1Row[] {
  if (options.mode === "files") {
    const historicalRows = readRowsFromWranglerExport(options.historicalPath);
    const latestRows = options.latestPath
      ? readRowsFromWranglerExport(options.latestPath)
      : [];

    return [...historicalRows, ...latestRows];
  }

  const historicalRows = queryLiveD1InPages({
    database: options.database,
    label: "historical_data",
    pageSize: d1PageSize,
    remote: options.remote,
    sql: "SELECT data_type, date, data FROM historical_data ORDER BY date ASC",
  });
  const latestRows = queryLiveD1InPages({
    database: options.database,
    label: "latest_data",
    pageSize: d1PageSize,
    remote: options.remote,
    sql: "SELECT data_type, data, last_updated FROM latest_data ORDER BY last_updated ASC",
  });

  return [...historicalRows, ...latestRows];
}

function queryLiveD1InPages(input: {
  database: string;
  label: string;
  pageSize: number;
  remote: boolean;
  sql: string;
}): D1Row[] {
  const spinner = ora(
    `Querying D1 ${input.label} in pages of ${input.pageSize}`,
  ).start();
  const rows: D1Row[] = [];
  let offset = 0;
  let pageNumber = 1;

  while (true) {
    const pagedSql =
      `SELECT * FROM (${stripTrailingSemicolon(input.sql)}) LIMIT ${input.pageSize} OFFSET ${offset}`;
    const result = executeWranglerD1Query({
      database: input.database,
      label: input.label,
      remote: input.remote,
      sql: pagedSql,
    });
    const pageRows = readRowsFromWranglerJson(
      result.stdout,
      `wrangler:${input.label}:page:${pageNumber}`,
    );

    rows.push(...pageRows);
    spinner.text =
      `Querying D1 ${input.label}: fetched ${rows.length} rows across ${pageNumber} page(s)`;

    if (pageRows.length < input.pageSize) {
      break;
    }

    offset += input.pageSize;
    pageNumber += 1;
  }

  spinner.succeed(`Fetched ${rows.length} rows from ${input.label}`).stop();
  return rows;
}

function executeWranglerD1Query(input: {
  database: string;
  label: string;
  remote: boolean;
  sql: string;
}): {
  stdout: string;
} {
  const commandArgs = [
    "wrangler",
    "d1",
    "execute",
    input.database,
    "--command",
    input.sql,
    "--json",
  ];

  if (input.remote) {
    commandArgs.push("--remote");
  }

  const result = spawnSync("bunx", commandArgs, {
    encoding: "utf8",
    env: process.env,
    maxBuffer: WRANGLER_MAX_BUFFER_BYTES,
  });

  if (result.error) {
    throw new Error(buildSpawnErrorMessage(result.error, input.label));
  }

  if (result.status !== 0) {
    const stderr = result.stderr.trim();
    const stdout = result.stdout.trim();
    const details = stderr || stdout || `exit code ${result.status ?? "unknown"}`;
    throw new Error(
      buildWranglerQueryErrorMessage({
        details,
        label: input.label,
        remote: input.remote,
      }),
    );
  }

  return {
    stdout: result.stdout,
  };
}

function failWithUsage(message: string): never {
  console.error(message);
  console.error(
    [
      "Usage:",
      "  bun run migrate:d1 [<historical.json> [latest.json]]",
      "  bun run migrate:d1 --d1 <database> [--remote|--local]",
      "",
      "No-arg mode reads from Cloudflare D1 using:",
      "  CLOUDFLARE_D1_DATABASE (or D1_DATABASE_NAME / CLOUDFLARE_D1_DATABASE_ID)",
      "",
      "Notes:",
      "  --remote (default) reads from Cloudflare D1 and does not need wrangler.toml bindings.",
      "  --local requires a Wrangler config with a matching D1 binding.",
      `  Set D1_MIGRATION_PAGE_SIZE to control D1 query page size (default ${DEFAULT_D1_PAGE_SIZE}).`,
    ].join("\n"),
  );
  process.exit(1);
}

function buildWranglerQueryErrorMessage(input: {
  details: string;
  label: string;
  remote: boolean;
}): string {
  const prefix = `wrangler d1 execute failed for ${input.label}: ${input.details}`;

  if (
    !input.remote &&
    input.details.includes("Couldn't find a D1 DB with the name or binding")
  ) {
    return (
      `${prefix}\n` +
      "Local D1 mode requires a Wrangler config (`wrangler.toml`) with a D1 binding.\n" +
      "Use `--remote` to query Cloudflare D1 directly, or provide JSON exports."
    );
  }

  if (input.details.includes("stdout or stderr buffer reached maxBuffer size")) {
    return (
      `${prefix}\n` +
      `Try lowering D1_MIGRATION_PAGE_SIZE (current ${d1PageSize}) and rerun.`
    );
  }

  return prefix;
}

function buildSpawnErrorMessage(error: Error, label: string): string {
  if (error.message.includes("ENOBUFS")) {
    return (
      `wrangler d1 execute failed for ${label}: ${error.message}\n` +
      `Try lowering D1_MIGRATION_PAGE_SIZE (current ${d1PageSize}) and rerun.`
    );
  }

  return `wrangler d1 execute failed for ${label}: ${error.message}`;
}

function stripTrailingSemicolon(sql: string): string {
  const trimmed = sql.trim();
  return trimmed.endsWith(";") ? trimmed.slice(0, -1) : trimmed;
}

function decodeLegacyPayload(encoded: string): unknown {
  const decodedBase64 = Buffer.from(encoded, "base64").toString("utf8");

  try {
    return JSON.parse(decodedBase64);
  } catch {
    try {
      return JSON.parse(encoded);
    } catch (error) {
      throw new Error(`Unable to decode payload as base64 JSON or plain JSON: ${error}`);
    }
  }
}

function parseDataType(candidate: string | undefined): DataType | null {
  if (!candidate) {
    return null;
  }

  switch (candidate) {
    case "mortgage-rates":
    case "personal-loan-rates":
    case "car-loan-rates":
    case "credit-card-rates":
      return candidate;
    default:
      return null;
  }
}

function readRowsFromWranglerExport(filePath: string): D1Row[] {
  const rawFile = readFileSync(filePath, "utf8");
  return readRowsFromWranglerJson(rawFile, filePath);
}

function readRowsFromWranglerJson(rawJson: string, source: string): D1Row[] {
  const trimmed = rawJson.trim();

  if (trimmed.length === 0) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(`Invalid JSON from ${source}: ${error}`);
  }

  return normalizeWranglerPayload(parsed, source);
}

function normalizeWranglerPayload(payload: unknown, source: string): D1Row[] {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return [];
    }

    const first = payload[0];

    if (isEnvelope(first)) {
      return payload.flatMap((entry) =>
        isEnvelope(entry) && Array.isArray(entry.results)
          ? entry.results.filter(isRow)
          : [],
      );
    }

    if (payload.every(isRow)) {
      return payload;
    }
  }

  if (isEnvelope(payload) && Array.isArray(payload.results)) {
    return payload.results.filter(isRow);
  }

  throw new Error(`Unsupported D1 export format: ${source}`);
}

function isEnvelope(value: unknown): value is D1ResultEnvelope {
  return typeof value === "object" && value !== null && "results" in value;
}

function isRow(value: unknown): value is D1Row {
  return typeof value === "object" && value !== null && "data_type" in value;
}

function validatePayload(dataType: DataType, payload: unknown): SupportedModels {
  return parseModelByDataType(dataType, payload);
}

function readSourceLastUpdated(
  payload: SupportedModels,
  fallback?: string,
): string {
  const candidate = payload.lastUpdated;

  if (typeof candidate === "string" && candidate.length > 0) {
    return candidate;
  }

  if (fallback && fallback.length > 0) {
    return fallback;
  }

  return new Date().toISOString();
}

function readPositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function toDateString(iso: string): string {
  const date = iso.split("T")[0];

  if (!date) {
    throw new Error(`Invalid ISO datetime: ${iso}`);
  }

  return date;
}
