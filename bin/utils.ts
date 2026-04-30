import { execFileSync } from "node:child_process";
import { type TSchema } from "elysia";
import ora from "ora";
import {
  type DataType,
  fromSavableJson,
  type SupportedModels,
  toSavableJson,
} from "../src/lib/data-loader";
import { parseSchema } from "../src/lib/schema";

type D1Target = {
  databaseName: string;
  flags: string[];
};

type D1RunOptions = {
  json?: boolean;
};

export function hasDataChanged(
  newData: SupportedModels,
  oldData: SupportedModels,
): boolean {
  return JSON.stringify(newData.data) !== JSON.stringify(oldData.data);
}

/**
 * Directly save data to D1 using Wrangler.
 * This is the preferred method for saving data in CI environments.
 */
export async function saveToD1(
  data: SupportedModels,
  dataType: DataType,
): Promise<boolean> {
  const envCheck = ora("Checking environment").start();
  envCheck
    .info(
      `CI=${process.env.CI}, GITHUB_ACTIONS=${process.env.GITHUB_ACTIONS}, D1_DATABASE_NAME=${process.env.D1_DATABASE_NAME ? "set" : "not set"}`,
    )
    .stop();

  const isCI = process.env.CI === "true" || Boolean(process.env.GITHUB_ACTIONS);

  if (!isCI) {
    const skipSpinner = ora("Checking CI environment").start();
    skipSpinner
      .warn("Skipping D1 database update in local development mode")
      .stop();
    return false;
  }

  const target = getD1Target();

  if (!target) {
    const noDbSpinner = ora("Checking D1 database name").start();
    noDbSpinner
      .fail(
        "D1_DATABASE_NAME not set. Set this environment variable to enable database updates",
      )
      .stop();
    return false;
  }

  try {
    const timestamp = new Date().toISOString().split("T")[0];
    const dataJson = toSavableJson(data);

    const prepareSpinner = ora("Preparing data for D1").start();
    prepareSpinner
      .succeed(
        `Data prepared for SQL insertion (${dataJson.length} characters, base64 encoded)`,
      )
      .stop();

    const testSpinner = ora(
      `Testing D1 database access for ${formatTarget(target)}`,
    ).start();
    const testResult = runWranglerD1(
      target,
      "SELECT count(*) FROM sqlite_master",
    );
    testSpinner
      .succeed(`D1 access test successful: ${testResult.trim()}`)
      .stop();

    const historySpinner = ora(
      `Saving historical data for ${dataType}`,
    ).start();
    runWranglerD1(
      target,
      `INSERT OR REPLACE INTO historical_data (data_type, date, data) VALUES ('${dataType}', '${timestamp}', '${dataJson}')`,
    );
    historySpinner
      .succeed(`Historical data saved for ${dataType} on ${timestamp}`)
      .stop();

    const latestSpinner = ora(`Updating latest data for ${dataType}`).start();
    runWranglerD1(
      target,
      `INSERT OR REPLACE INTO latest_data (data_type, data, last_updated) VALUES ('${dataType}', '${dataJson}', CURRENT_TIMESTAMP)`,
    );
    latestSpinner.succeed(`Latest data updated for ${dataType}`).stop();

    const verifySpinner = ora("Verifying data was saved").start();
    const verifyResult = runWranglerD1(
      target,
      `SELECT data_type, last_updated FROM latest_data WHERE data_type='${dataType}'`,
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
 * Load data from D1 database.
 */
export async function loadFromD1<Schema extends TSchema>(
  dataType: DataType,
  schema: Schema,
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
      `Loading latest data for ${dataType} from D1`,
    ).start();
    const result = runWranglerD1(
      target,
      `SELECT data FROM latest_data WHERE data_type = '${dataType}'`,
      { json: true },
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

function getD1Target(): D1Target | null {
  const rawDatabaseName = process.env.D1_DATABASE_NAME?.trim();

  if (!rawDatabaseName) {
    return null;
  }

  const [databaseName, ...legacyFlags] = rawDatabaseName.split(/\s+/);

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

function runWranglerD1(
  target: D1Target,
  command: string,
  options: D1RunOptions = {},
): string {
  const args = [
    "wrangler",
    "d1",
    "execute",
    target.databaseName,
    ...target.flags,
    "--command",
    command,
  ];

  if (options.json) {
    args.push("--json");
  }

  return execFileSync("npx", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function extractWranglerRows(output: string): Record<string, unknown>[] {
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

function formatTarget(target: D1Target): string {
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
