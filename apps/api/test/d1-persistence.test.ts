import { describe, expect, test } from "bun:test";

import { migrateD1 } from "../bin/migrate-d1";
import type { D1RunOptions, D1Target } from "../bin/utils";
import { markCheckedInD1, saveToD1 } from "../bin/utils";
import type { MortgageRates } from "../src/models/mortgage-rates";

const FIXED_DATE = new Date("2026-04-30T12:00:00.000Z");

function sampleData(): MortgageRates {
  return {
    type: "MortgageRates",
    data: [
      {
        id: "institution:anz",
        name: "ANZ",
        products: [
          {
            id: "product:anz:standard",
            name: "Standard",
            rates: [],
          },
        ],
      },
    ],
    lastUpdated: FIXED_DATE.toISOString(),
  };
}

interface RecordedCall {
  target: D1Target;
  command: string;
  options?: D1RunOptions;
}

function recordingRun(handler: (call: RecordedCall) => string) {
  const calls: RecordedCall[] = [];
  const run = (
    target: D1Target,
    command: string,
    options?: D1RunOptions
  ): string => {
    const call = { target, command, options };
    calls.push(call);
    return handler(call);
  };
  return { run, calls };
}

const testTarget: D1Target = { databaseName: "fake-db", flags: [] };

describe("saveToD1 batching", () => {
  test("submits exactly one mutation call containing both statements, history before latest", async () => {
    const { run, calls } = recordingRun(() => "ok");

    const result = await saveToD1(sampleData(), "mortgage-rates", {
      target: testTarget,
      run,
      now: () => FIXED_DATE,
    });

    expect(result).toBe(true);

    const mutationCalls = calls.filter((call) =>
      call.command.includes("INSERT OR REPLACE")
    );
    expect(mutationCalls).toHaveLength(1);

    const [mutation] = mutationCalls;
    if (!mutation) {
      throw new Error("expected a mutation call to have been recorded");
    }
    const historyIndex = mutation.command.indexOf(
      "INSERT OR REPLACE INTO historical_data"
    );
    const latestIndex = mutation.command.indexOf(
      "INSERT OR REPLACE INTO latest_data"
    );

    expect(historyIndex).toBeGreaterThanOrEqual(0);
    expect(latestIndex).toBeGreaterThan(historyIndex);

    const between = mutation.command.slice(
      historyIndex + "INSERT OR REPLACE INTO historical_data".length,
      latestIndex
    );
    expect(between).toContain(";");
    expect(mutation.command).toContain("2026-04-30");
  });

  test("keeps the access probe and verification calls separate and non-mutating", async () => {
    const { run, calls } = recordingRun(() => "ok");

    await saveToD1(sampleData(), "mortgage-rates", {
      target: testTarget,
      run,
      now: () => FIXED_DATE,
    });

    expect(calls).toHaveLength(3);

    const [probe, mutation, verify] = calls;
    if (!(probe && mutation && verify)) {
      throw new Error(
        "expected probe, mutation, and verify calls to be recorded"
      );
    }
    expect(probe.command).not.toContain("INSERT OR REPLACE");
    expect(probe.command).toContain("SELECT count(*)");

    expect(mutation.command).toContain("INSERT OR REPLACE");

    expect(verify.command).not.toContain("INSERT OR REPLACE");
    expect(verify.command).toContain("SELECT data_type, last_updated");
  });

  test("returns false when the mutation call throws, and never calls verify", async () => {
    const { run, calls } = recordingRun((call) => {
      if (call.command.includes("INSERT OR REPLACE")) {
        throw new Error("forced mutation failure");
      }
      return "ok";
    });

    const result = await saveToD1(sampleData(), "mortgage-rates", {
      target: testTarget,
      run,
      now: () => FIXED_DATE,
    });

    expect(result).toBe(false);
    // Only the probe and the failed mutation attempt should have run;
    // verification must not be reached after a mutation failure.
    expect(calls).toHaveLength(2);
    expect(
      calls.some((call) => call.command.includes("SELECT data_type"))
    ).toBe(false);
  });

  test("returns false without calling run when there is no target", async () => {
    const { run, calls } = recordingRun(() => "ok");

    const result = await saveToD1(sampleData(), "mortgage-rates", {
      target: null,
      run,
    });

    expect(result).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

// Wrangler exits non-zero and prints the SQLite error on stderr.
function wranglerError(sqliteMessage: string): Error {
  return Object.assign(new Error("Command failed: npx wrangler d1 execute"), {
    stdout: "",
    stderr: `✘ [ERROR] ${sqliteMessage}: SQLITE_ERROR`,
  });
}

describe("saveToD1 last_checked", () => {
  test("sets last_checked in the same statement batch as last_updated", async () => {
    const { run, calls } = recordingRun(() => "ok");

    await saveToD1(sampleData(), "mortgage-rates", {
      target: testTarget,
      run,
      now: () => FIXED_DATE,
    });

    const mutations = calls.filter((call) =>
      call.command.includes("INSERT OR REPLACE")
    );
    expect(mutations).toHaveLength(1);
    expect(mutations[0]?.command).toContain(
      "INSERT OR REPLACE INTO latest_data (data_type, data, last_updated, last_checked)"
    );
    expect(mutations[0]?.command).toContain(
      "CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    );
  });

  test("saves without last_checked when the column does not exist yet", async () => {
    const { run, calls } = recordingRun((call) => {
      if (call.command.includes("last_checked")) {
        throw wranglerError(
          "table latest_data has no column named last_checked"
        );
      }
      return "ok";
    });

    const result = await saveToD1(sampleData(), "mortgage-rates", {
      target: testTarget,
      run,
      now: () => FIXED_DATE,
    });

    expect(result).toBe(true);
    const mutations = calls.filter((call) =>
      call.command.includes("INSERT OR REPLACE")
    );
    expect(mutations).toHaveLength(2);
    const [, fallback] = mutations;
    expect(fallback?.command).toContain(
      "INSERT OR REPLACE INTO historical_data"
    );
    expect(fallback?.command).toContain(
      "INSERT OR REPLACE INTO latest_data (data_type, data, last_updated) VALUES"
    );
    expect(calls.at(-1)?.command).toContain("SELECT data_type, last_updated");
  });
});

describe("markCheckedInD1", () => {
  test("sets last_checked for the data type only", async () => {
    const { run, calls } = recordingRun(() => "ok");

    const result = await markCheckedInD1("car-loan-rates", {
      target: testTarget,
      run,
    });

    expect(result).toBe(true);
    expect(calls.map((call) => call.command)).toEqual([
      "UPDATE latest_data SET last_checked = CURRENT_TIMESTAMP WHERE data_type='car-loan-rates'",
    ]);
  });

  test("returns false without throwing when the column does not exist", async () => {
    const { run } = recordingRun(() => {
      throw wranglerError("no such column: last_checked");
    });

    await expect(
      markCheckedInD1("car-loan-rates", { target: testTarget, run })
    ).resolves.toBe(false);
  });

  test("returns false without throwing when D1 fails", async () => {
    const { run } = recordingRun(() => {
      throw new Error("D1 is not available");
    });

    await expect(
      markCheckedInD1("car-loan-rates", { target: testTarget, run })
    ).resolves.toBe(false);
  });

  test("returns false without calling run when there is no target", async () => {
    const { run, calls } = recordingRun(() => "ok");

    await expect(
      markCheckedInD1("car-loan-rates", { target: null, run })
    ).resolves.toBe(false);
    expect(calls).toHaveLength(0);
  });
});

// The JSON that `wrangler d1 execute --json` prints for PRAGMA table_info.
function tableInfo(columns: string[]): string {
  return JSON.stringify([
    { results: columns.map((name, cid) => ({ cid, name })), success: true },
  ]);
}

describe("migrateD1", () => {
  test("adds last_checked when latest_data does not have it", () => {
    let columns = ["data_type", "data", "last_updated"];
    const { run, calls } = recordingRun((call) => {
      if (call.command.startsWith("ALTER TABLE")) {
        columns = [...columns, "last_checked"];
        return "ok";
      }
      return tableInfo(columns);
    });

    expect(migrateD1({ target: testTarget, run })).toBe("added");
    expect(calls.map((call) => call.command)).toEqual([
      "PRAGMA table_info(latest_data)",
      "ALTER TABLE latest_data ADD COLUMN last_checked DATETIME",
      "PRAGMA table_info(latest_data)",
    ]);
    expect(calls[0]?.options).toEqual({ json: true });
  });

  test("changes nothing when latest_data already has last_checked", () => {
    const { run, calls } = recordingRun(() =>
      tableInfo(["data_type", "data", "last_updated", "last_checked"])
    );

    expect(migrateD1({ target: testTarget, run })).toBe("already-present");
    expect(calls.map((call) => call.command)).toEqual([
      "PRAGMA table_info(latest_data)",
    ]);
  });

  test("accepts a column that another run added first", () => {
    let pragmaCalls = 0;
    const { run } = recordingRun((call) => {
      if (call.command.startsWith("ALTER TABLE")) {
        throw wranglerError("duplicate column name: last_checked");
      }
      pragmaCalls += 1;
      return tableInfo(
        pragmaCalls === 1
          ? ["data_type", "data", "last_updated"]
          : ["data_type", "data", "last_updated", "last_checked"]
      );
    });

    expect(migrateD1({ target: testTarget, run })).toBe("already-present");
  });

  test("throws when the ALTER fails and the column is still missing", () => {
    const { run } = recordingRun((call) => {
      if (call.command.startsWith("ALTER TABLE")) {
        throw new Error("D1 is not available");
      }
      return tableInfo(["data_type", "data", "last_updated"]);
    });

    expect(() => migrateD1({ target: testTarget, run })).toThrow(
      "D1 is not available"
    );
  });

  test("throws when latest_data does not exist", () => {
    const { run, calls } = recordingRun(() => tableInfo([]));

    expect(() => migrateD1({ target: testTarget, run })).toThrow(
      "latest_data does not exist"
    );
    expect(calls).toHaveLength(1);
  });

  test("throws without calling run when there is no target", () => {
    const { run, calls } = recordingRun(() => "ok");

    expect(() => migrateD1({ target: null, run })).toThrow(
      "D1_DATABASE_NAME not set"
    );
    expect(calls).toHaveLength(0);
  });
});
