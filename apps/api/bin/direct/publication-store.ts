import { randomUUID } from "node:crypto";

import { fromSavableJson, toSavableJson } from "../../src/lib/data-loader";
import type { DataType, SupportedModels } from "../../src/lib/data-loader";
import { parseSchema } from "../../src/lib/schema";
import {
  extractWranglerRows,
  getD1Target,
  isMissingLastCheckedError,
  runWranglerD1,
} from "../utils";
import type { D1SaveDeps } from "../utils";
import { schemas } from "./collect";

/** A revision covers data AND complete-check freshness, including unchanged checks. */
const publicationSchema = `CREATE TABLE IF NOT EXISTS publication_state (
  data_type TEXT PRIMARY KEY,
  revision TEXT NOT NULL,
  collected_at TEXT NOT NULL
)`;

/**
 * One store per collection. Read the baseline and its revision together, then
 * claim that revision in the same atomic D1 batch as every publication write.
 * Conflicts require a fresh collection; re-merging old observations is unsafe.
 */
export function createPublicationStore(
  dataset: DataType,
  checkedAt: string,
  deps: D1SaveDeps = {}
) {
  const collectedAt = new Date(checkedAt).toISOString();
  const target = deps.target === undefined ? getD1Target() : deps.target;
  const run = deps.run ?? runWranglerD1;
  let baseline: { revision: string | null } | undefined;

  function execute(sql: string, json = false) {
    if (!target) {
      throw new Error("Cannot publish without a configured D1 target");
    }
    return run(target, sql, { json });
  }

  function read(): SupportedModels | null {
    // Safe for existing deployments too: this additive table needs no optional
    // last_checked migration, and CREATE IF NOT EXISTS tolerates competing runs.
    execute(publicationSchema);
    const [row] = extractWranglerRows(
      execute(
        `SELECT l.data, p.revision FROM (SELECT '${dataset}' AS data_type) AS d LEFT JOIN latest_data AS l ON l.data_type=d.data_type LEFT JOIN publication_state AS p ON p.data_type=d.data_type`,
        true
      ),
      true
    );
    if (!row || !(row.revision === null || typeof row.revision === "string")) {
      throw new Error(`Invalid publication baseline for ${dataset}`);
    }
    const model =
      row.data === null && row.revision === null
        ? null
        : parseSchema(schemas[dataset], fromSavableJson(requireData(row.data)));
    baseline = { revision: row.revision };
    return model;
  }

  function commit(model: SupportedModels | null, complete: boolean) {
    if (!baseline) {
      throw new Error("Read the publication baseline before writing");
    }
    const revision = randomUUID();
    const expected =
      baseline.revision === null
        ? "0"
        : `publication_state.revision='${sqlString(baseline.revision)}'`;
    const claim = `INSERT INTO publication_state (data_type, revision, collected_at) VALUES ('${dataset}', '${revision}', '${collectedAt}') ON CONFLICT(data_type) DO UPDATE SET revision=excluded.revision, collected_at=excluded.collected_at WHERE ${expected} AND publication_state.collected_at < excluded.collected_at`;
    const guard = `EXISTS (SELECT 1 FROM publication_state WHERE data_type='${dataset}' AND revision='${revision}')`;
    const statements = [claim];
    let legacyLatest: string | undefined;
    if (model) {
      const date = (deps.now?.() ?? new Date()).toISOString().slice(0, 10);
      const encoded = toSavableJson(model);
      // Keep each SQL statement below D1's 100 KB limit even for large snapshots.
      const chunkSize = 32_768;
      statements.push(
        `INSERT OR REPLACE INTO historical_data (data_type, date, data) SELECT '${dataset}', '${date}', '${encoded.slice(0, chunkSize)}' WHERE ${guard}`
      );
      for (
        let offset = chunkSize;
        offset < encoded.length;
        offset += chunkSize
      ) {
        statements.push(
          `UPDATE historical_data SET data=data || '${encoded.slice(offset, offset + chunkSize)}' WHERE data_type='${dataset}' AND date='${date}' AND ${guard}`
        );
      }
      const snapshot = `(SELECT data FROM historical_data WHERE data_type='${dataset}' AND date='${date}')`;
      const checkColumn = complete ? ", last_checked" : "";
      const checkValue = complete ? ", CURRENT_TIMESTAMP" : "";
      const checkUpdate = complete
        ? ", last_checked=excluded.last_checked"
        : "";
      legacyLatest = `INSERT INTO latest_data (data_type, data, last_updated) SELECT '${dataset}', ${snapshot}, CURRENT_TIMESTAMP WHERE ${guard} ON CONFLICT(data_type) DO UPDATE SET data=excluded.data, last_updated=excluded.last_updated`;
      statements.push(
        `INSERT INTO latest_data (data_type, data, last_updated${checkColumn}) SELECT '${dataset}', ${snapshot}, CURRENT_TIMESTAMP${checkValue} WHERE ${guard} ON CONFLICT(data_type) DO UPDATE SET data=excluded.data, last_updated=excluded.last_updated${checkUpdate}`
      );
    } else {
      statements.push(
        `UPDATE latest_data SET last_checked=CURRENT_TIMESTAMP WHERE data_type='${dataset}' AND ${guard}`
      );
    }
    try {
      execute(statements.join("; "));
    } catch (error) {
      if (!legacyLatest || !complete || !isMissingLastCheckedError(error)) {
        throw error;
      }
      // The failed batch rolled back its claim too. Preserve the existing
      // compatibility path without ever pretending a legacy check was recorded.
      console.warn(
        "latest_data has no last_checked column; run bun run db:migrate"
      );
      execute([...statements.slice(0, -1), legacyLatest].join("; "));
    }
    // Use a separate JSON query for both command and file execution. A later
    // writer racing this acknowledgement yields a safe reported conflict.
    const [saved] = extractWranglerRows(
      execute(
        `SELECT revision FROM publication_state WHERE data_type='${dataset}'`,
        true
      ),
      true
    );
    if (saved?.revision !== revision) {
      throw new Error(
        `Rejected concurrent or newer publication of ${dataset}; collect again before retrying`
      );
    }
  }

  return { read, save: commit, markChecked: () => commit(null, true) };
}

function requireData(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError("Publication baseline has no stored data");
  }
  return value;
}

function sqlString(value: string) {
  return value.replaceAll("'", "''");
}
