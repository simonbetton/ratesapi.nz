import { describe, expect, test } from "bun:test";

import type { D1RunOptions, D1Target } from "../bin/utils";
import { saveToD1 } from "../bin/utils";
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
