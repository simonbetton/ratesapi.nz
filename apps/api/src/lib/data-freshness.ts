import type { Database } from "./environment";
import { createLogger } from "./logging";

const log = createLogger("data-freshness");

// The scrapers check each dataset each hour. A dataset is stale when no
// check succeeded in 3 hours, so one late or failed run is not enough.
export const staleAfterMs = 3 * 60 * 60 * 1000;

export interface DataSetFreshness {
  dataType: string;
  lastUpdated: string;
  lastChecked: string | null;
  stale: boolean | null;
}

export async function readDataSetFreshness(
  db: Database,
  now = Date.now()
): Promise<DataSetFreshness[]> {
  const rows = await selectFreshnessRows(db);

  return rows.flatMap((row) => {
    const dataType = row.data_type;
    const lastUpdated = row.last_updated;

    if (typeof dataType !== "string" || typeof lastUpdated !== "string") {
      return [];
    }

    const lastChecked =
      typeof row.last_checked === "string" ? row.last_checked : null;

    return [
      { dataType, lastUpdated, lastChecked, stale: isStale(lastChecked, now) },
    ];
  });
}

async function selectFreshnessRows(db: Database) {
  try {
    const result = await db
      .prepare(
        "SELECT data_type, last_updated, last_checked FROM latest_data ORDER BY data_type ASC"
      )
      .all();
    return result.results;
  } catch (error) {
    // A database that bin/migrate-d1.ts has not migrated has no
    // last_checked column. It can still give the time of the last change.
    log.warn({ error }, "Unable to read last_checked, using last_updated only");
    const result = await db
      .prepare(
        "SELECT data_type, last_updated FROM latest_data ORDER BY data_type ASC"
      )
      .all();
    return result.results;
  }
}

function isStale(lastChecked: string | null, now: number): boolean | null {
  const checkedAt = lastChecked === null ? undefined : parseUtc(lastChecked);

  return checkedAt === undefined ? null : now - checkedAt > staleAfterMs;
}

// SQLite CURRENT_TIMESTAMP values are UTC, in "YYYY-MM-DD HH:MM:SS" format
// with no time zone.
function parseUtc(value: string): number | undefined {
  const isoValue = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const time = Date.parse(isoValue);

  return Number.isNaN(time) ? undefined : time;
}
