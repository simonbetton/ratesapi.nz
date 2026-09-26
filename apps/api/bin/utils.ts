import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { TSchema } from "elysia";
import ora from "ora";

import { fromSavableJson, toSavableJson } from "../src/lib/data-loader";
import type { DataType, SupportedModels } from "../src/lib/data-loader";
import { parseSchema } from "../src/lib/schema";

export interface D1Target {
  databaseName: string;
  flags: string[];
}

export interface D1RunOptions {
  json?: boolean;
}

/**
 * Injectable dependencies for {@link saveToD1}, used by tests to point at a
 * temporary local D1 target and to control the run/verify command executor
 * and the "current" date without touching the production Wrangler target.
 * Production callers omit this parameter entirely and get the existing
 * `getD1Target()` / `runWranglerD1` / `new Date()` behavior unchanged.
 */
export interface D1SaveDeps {
  target?: D1Target | null;
  run?: (target: D1Target, command: string, options?: D1RunOptions) => string;
  now?: () => Date;
}

const wranglerConfigPath = fileURLToPath(
  new URL("../wrangler.toml", import.meta.url)
);

const missingLastCheckedWarning =
  "latest_data has no last_checked column, so the check is not recorded. Run `bun run db:migrate` to add it.";

export function hasDataChanged(
  newData: SupportedModels,
  oldData: SupportedModels
): boolean {
  return JSON.stringify(newData.data) !== JSON.stringify(oldData.data);
}

/**
 * Directly save data to D1 using Wrangler.
 * This is the preferred method for saving data in CI environments.
 */
// Wrangler runs synchronously today, but callers treat D1 I/O as async.
// oxlint-disable-next-line require-await
export async function saveToD1(
  data: SupportedModels,
  dataType: DataType,
  deps: D1SaveDeps = {}
): Promise<boolean> {
  const envCheck = ora("Checking environment").start();
  envCheck
    .info(
      `CI=${process.env.CI}, GITHUB_ACTIONS=${process.env.GITHUB_ACTIONS}, D1_DATABASE_NAME=${process.env.D1_DATABASE_NAME ? "set" : "not set"}`
    )
    .stop();

  const target = deps.target === undefined ? getD1Target() : deps.target;
  const run = deps.run ?? runWranglerD1;
  const now = deps.now ?? (() => new Date());

  if (!target) {
    const noDbSpinner = ora("Checking D1 database name").start();
    noDbSpinner
      .fail(
        "D1_DATABASE_NAME not set. Set this environment variable to enable database updates"
      )
      .stop();
    return false;
  }

  try {
    const [timestamp] = now().toISOString().split("T");
    const dataJson = toSavableJson(data);

    const prepareSpinner = ora("Preparing data for D1").start();
    prepareSpinner
      .succeed(
        `Data prepared for SQL insertion (${dataJson.length} characters, base64 encoded)`
      )
      .stop();

    const testSpinner = ora(
      `Testing D1 database access for ${formatTarget(target)}`
    ).start();
    const testResult = run(target, "SELECT count(*) FROM sqlite_master");
    testSpinner
      .succeed(`D1 access test successful: ${testResult.trim()}`)
      .stop();

    const saveSpinner = ora(`Saving ${dataType} snapshot`).start();
    const historyStatement = `INSERT OR REPLACE INTO historical_data (data_type, date, data) VALUES ('${dataType}', '${timestamp}', '${dataJson}')`;

    try {
      // A save is also a successful check, so last_checked is written in
      // the same batch as last_updated.
      run(
        target,
        [
          historyStatement,
          `INSERT OR REPLACE INTO latest_data (data_type, data, last_updated, last_checked) VALUES ('${dataType}', '${dataJson}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        ].join("; ")
      );
    } catch (error) {
      if (!isMissingLastCheckedError(error)) {
        throw error;
      }

      // D1 rolled back the failed batch. Save without last_checked until
      // `bun run db:migrate` adds the column.
      saveSpinner.warn(missingLastCheckedWarning).stop();
      run(
        target,
        [
          historyStatement,
          `INSERT OR REPLACE INTO latest_data (data_type, data, last_updated) VALUES ('${dataType}', '${dataJson}', CURRENT_TIMESTAMP)`,
        ].join("; ")
      );
    }
    saveSpinner
      .succeed(`Snapshot saved for ${dataType} on ${timestamp}`)
      .stop();

    const verifySpinner = ora("Verifying data was saved").start();
    const verifyResult = run(
      target,
      `SELECT data_type, last_updated FROM latest_data WHERE data_type='${dataType}'`
    );
    verifySpinner
      .succeed(`Verification successful: ${verifyResult.trim()}`)
      .stop();

    return true;
  } catch (error) {
    const errorSpinner = ora("Saving to D1 database").start();
    errorSpinner.fail(`Failed to save data to D1 database: ${error}`).stop();

    if (error instanceof Error && error.stack) {
      const stackSpinner = ora("Error details").start();
      stackSpinner.fail(`Error stack: ${error.stack}`).stop();
    }

    return false;
  }
}

/**
 * Record a successful check of unchanged data: set `last_checked` for the
 * data type. This never throws. A failure (for example, a database without
 * the `last_checked` column) only logs a warning, because the scrape itself
 * succeeded.
 */
// Wrangler runs synchronously today, but callers treat D1 I/O as async.
// oxlint-disable-next-line require-await
export async function markCheckedInD1(
  dataType: DataType,
  deps: Omit<D1SaveDeps, "now"> = {}
): Promise<boolean> {
  const target = deps.target === undefined ? getD1Target() : deps.target;
  const run = deps.run ?? runWranglerD1;
  const spinner = ora(`Recording the check of ${dataType}`).start();

  if (!target) {
    spinner.warn("D1_DATABASE_NAME not set. The check is not recorded").stop();
    return false;
  }

  try {
    run(
      target,
      `UPDATE latest_data SET last_checked = CURRENT_TIMESTAMP WHERE data_type='${dataType}'`
    );
    spinner.succeed(`Check recorded for ${dataType}`).stop();
    return true;
  } catch (error) {
    spinner
      .warn(
        isMissingLastCheckedError(error)
          ? missingLastCheckedWarning
          : `Failed to record the check of ${dataType}: ${error}`
      )
      .stop();
    return false;
  }
}

/**
 * Load data from D1 database.
 */
// Wrangler runs synchronously today, but callers treat D1 I/O as async.
// oxlint-disable-next-line require-await
export async function loadFromD1<Schema extends TSchema>(
  dataType: DataType,
  schema: Schema
): Promise<Schema["static"] | null> {
  const envCheck = ora("Checking D1 environment").start();
  const isCI = process.env.CI === "true" || Boolean(process.env.GITHUB_ACTIONS);
  const target = getD1Target();

  if (!isCI || !target) {
    envCheck.warn("Running in local development mode without D1 access").stop();
    return null;
  }

  envCheck.succeed("D1 access available").stop();

  try {
    const loadSpinner = ora(
      `Loading latest data for ${dataType} from D1`
    ).start();
    const result = runWranglerD1(
      target,
      `SELECT data FROM latest_data WHERE data_type = '${dataType}'`,
      { json: true }
    );

    loadSpinner.succeed(`Data loaded from D1 database for ${dataType}`).stop();

    const rows = extractWranglerRows(result);
    const encodedData = rows[0]?.data;

    if (typeof encodedData !== "string") {
      return null;
    }

    return parseSchema(schema, fromSavableJson(encodedData));
  } catch (error) {
    const errorSpinner = ora("D1 database connection").start();
    errorSpinner.fail(`Database connection failed: ${error}`).stop();
  }

  return null;
}

// Wrangler prints the SQLite error on stderr. The command (and so the error
// message) always contains "last_checked", so match the SQLite text only.
function isMissingLastCheckedError(error: unknown): boolean {
  const output = [
    error instanceof Error ? error.message : String(error),
    readOutput(error, "stdout"),
    readOutput(error, "stderr"),
  ].join("\n");

  return /no such column: last_checked|has no column named last_checked/u.test(
    output
  );
}

function readOutput(error: unknown, key: "stdout" | "stderr"): string {
  if (!isRecord(error)) {
    return "";
  }

  const value = error[key];
  if (typeof value === "string") {
    return value;
  }

  return value instanceof Uint8Array ? new TextDecoder().decode(value) : "";
}

export function getD1Target(): D1Target | null {
  const rawDatabaseName = process.env.D1_DATABASE_NAME?.trim();

  if (!rawDatabaseName) {
    return null;
  }

  const [databaseName, ...legacyFlags] = rawDatabaseName.split(/\s+/u);

  if (!databaseName) {
    return null;
  }

  const flags = legacyFlags.filter(isSupportedD1Flag);

  if (isTruthyEnv(process.env.D1_REMOTE) && !flags.includes("--remote")) {
    flags.push("--remote");
  }

  if (isTruthyEnv(process.env.D1_LOCAL) && !flags.includes("--local")) {
    flags.push("--local");
  }

  return { databaseName, flags };
}

export function runWranglerD1(
  target: D1Target,
  command: string,
  options: D1RunOptions = {}
): string {
  const args = [
    "wrangler",
    "d1",
    "execute",
    target.databaseName,
    "--config",
    wranglerConfigPath,
    ...target.flags,
    "--command",
    command,
  ];

  if (options.json) {
    args.push("--json");
  }

  return execFileSync("npx", args, {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function extractWranglerRows(output: string): Record<string, unknown>[] {
  const parsed: unknown = JSON.parse(output);
  const entries = Array.isArray(parsed) ? parsed : [parsed];
  const rows: Record<string, unknown>[] = [];

  for (const entry of entries) {
    if (!isRecord(entry)) {
      continue;
    }

    const resultRows = entry.results ?? entry.result;

    if (Array.isArray(resultRows)) {
      rows.push(...resultRows.filter(isRecord));
    }
  }

  return rows;
}

export function formatTarget(target: D1Target): string {
  return [target.databaseName, ...target.flags].join(" ");
}

function isSupportedD1Flag(value: string): boolean {
  return value === "--remote" || value === "--local";
}

function isTruthyEnv(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "yes";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
