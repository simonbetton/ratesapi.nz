/**
 * Adds the columns that schema.sql has, but that a database made from an
 * older schema.sql does not have (`CREATE TABLE IF NOT EXISTS` does not add
 * columns to an existing table). It is idempotent: when the columns exist it
 * changes nothing, so the scrape workflow can run it before each scrape.
 *
 * It uses the same D1 target as the scrapers (D1_DATABASE_NAME, D1_REMOTE,
 * D1_LOCAL), for example:
 *
 *   D1_DATABASE_NAME=ratesapi-data D1_LOCAL=true bun run db:migrate
 */
import ora from "ora";

import type { D1RunOptions, D1Target } from "./utils";
import {
  extractWranglerRows,
  formatTarget,
  getD1Target,
  runWranglerD1,
} from "./utils";

/**
 * Injectable dependencies for {@link migrateD1}, used by tests to point at a
 * temporary local D1 target. Production callers omit them and get
 * `getD1Target()` / `runWranglerD1`.
 */
export interface D1MigrateDeps {
  target?: D1Target | null;
  run?: (target: D1Target, command: string, options?: D1RunOptions) => string;
}

export type MigrationOutcome = "added" | "already-present";

export function migrateD1(deps: D1MigrateDeps = {}): MigrationOutcome {
  const target = deps.target === undefined ? getD1Target() : deps.target;
  const run = deps.run ?? runWranglerD1;

  if (!target) {
    throw new Error(
      "D1_DATABASE_NAME not set. Set this environment variable to choose the database to migrate"
    );
  }

  const spinner = ora(`Migrating ${formatTarget(target)}`).start();

  try {
    if (hasLastCheckedColumn(target, run)) {
      spinner.succeed("latest_data already has last_checked").stop();
      return "already-present";
    }

    try {
      run(target, "ALTER TABLE latest_data ADD COLUMN last_checked DATETIME");
    } catch (error) {
      // Another run (for example, a second workflow run at the same time)
      // can add the column between the check and the ALTER TABLE.
      if (!hasLastCheckedColumn(target, run)) {
        throw error;
      }

      spinner.succeed("latest_data already has last_checked").stop();
      return "already-present";
    }

    if (!hasLastCheckedColumn(target, run)) {
      throw new Error("latest_data has no last_checked column after ALTER");
    }

    spinner.succeed("Added last_checked to latest_data").stop();
    return "added";
  } catch (error) {
    spinner.fail(`Migration failed: ${error}`).stop();
    throw error;
  }
}

function hasLastCheckedColumn(
  target: D1Target,
  run: NonNullable<D1MigrateDeps["run"]>
): boolean {
  const columns = extractWranglerRows(
    run(target, "PRAGMA table_info(latest_data)", { json: true })
  );

  if (columns.length === 0) {
    throw new Error("latest_data does not exist. Apply schema.sql first");
  }

  return columns.some((column) => column.name === "last_checked");
}

if (import.meta.main) {
  try {
    migrateD1();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
