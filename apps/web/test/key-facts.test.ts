import { describe, expect, test } from "bun:test";
import { setTimeout as delay } from "node:timers/promises";

import {
  fetchKeyFacts,
  formatDay,
  keyFactStats,
  keyFactsSummary,
} from "../src/lib/key-facts";
import type { KeyFacts, RatesApiFetcher } from "../src/lib/key-facts";

function providers(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `institution:${index}`,
  }));
}

const payloads: Record<string, unknown> = {
  "/api/v1/mortgage-rates": {
    type: "MortgageRates",
    data: providers(36),
    lastUpdated: "2026-09-25T01:20:30.582Z",
  },
  "/api/v1/personal-loan-rates": {
    type: "PersonalLoanRates",
    data: providers(39),
    lastUpdated: "2026-06-25T03:11:57.011Z",
  },
  "/api/v1/car-loan-rates": {
    type: "CarLoanRates",
    data: providers(32),
    lastUpdated: "2026-08-08T03:24:47.442Z",
  },
  "/api/v1/credit-card-rates": {
    type: "CreditCardRates",
    data: providers(33),
    lastUpdated: "2026-09-25T07:57:32.965Z",
  },
  "/api/v1/mortgage-rates/time-series": {
    type: "MortgageRatesTimeSeries",
    timeSeries: {},
    availableDates: ["2025-03-09", "2025-03-08", "2026-09-25"],
  },
};

type Override = (init?: RequestInit) => Promise<Response>;

function fakeApi(
  overrides: Record<string, Override> = {}
): RatesApiFetcher & { requested: string[] } {
  const requested: string[] = [];
  return {
    requested,
    fetch: async (input, init) => {
      const { pathname } = new URL(input);
      requested.push(pathname);
      const override = overrides[pathname];
      if (override) {
        return override(init);
      }
      return Response.json(payloads[pathname]);
    },
  };
}

// Answers after a minute, unless the request is aborted first.
async function slowResponse(init?: RequestInit) {
  await delay(60_000, undefined, { signal: init?.signal ?? undefined });
  return Response.json({});
}

const facts: KeyFacts = {
  mortgageLenders: 36,
  personalLoanLenders: 39,
  carLoanLenders: 32,
  creditCardIssuers: 33,
  lastUpdated: "2026-09-25T07:57:32.965Z",
  historyStart: "2025-03-08",
};

function wordCount(text: string) {
  return text.split(/\s+/u).filter(Boolean).length;
}

describe("key facts from the API", () => {
  test("counts providers, and finds the newest update and first snapshot", async () => {
    const api = fakeApi();
    expect(await fetchKeyFacts(api)).toEqual(facts);
    expect(api.requested.toSorted()).toEqual(Object.keys(payloads).toSorted());
  });

  test("gives up on any failed, unexpected or empty response", async () => {
    const failures: Record<string, Override>[] = [
      {
        "/api/v1/car-loan-rates": async () =>
          new Response("Unavailable", { status: 503 }),
      },
      {
        "/api/v1/mortgage-rates": async () => {
          throw new TypeError("Network connection lost");
        },
      },
      {
        "/api/v1/credit-card-rates": async () => new Response("<html></html>"),
      },
      {
        "/api/v1/personal-loan-rates": async () =>
          Response.json({ type: "CarLoanRates", data: [], lastUpdated: "x" }),
      },
      {
        "/api/v1/mortgage-rates/time-series": async () =>
          Response.json({ availableDates: [] }),
      },
    ];
    const results = await Promise.all(
      failures.map((overrides) => fetchKeyFacts(fakeApi(overrides)))
    );
    expect(results).toEqual(failures.map(() => null));
  });

  test("stops waiting after the time limit", async () => {
    const started = performance.now();
    const result = await fetchKeyFacts(
      fakeApi({ "/api/v1/mortgage-rates/time-series": slowResponse }),
      50
    );
    expect(result).toBeNull();
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("key facts copy", () => {
  test("formats days the New Zealand way", () => {
    expect(formatDay("2025-03-08")).toBe("8 March 2025");
  });

  test("states live coverage in one quotable paragraph", () => {
    const summary = keyFactsSummary(facts);
    expect(summary).toContain(
      "36 mortgage lenders, 39 personal loan lenders, 32 car loan lenders and 33 credit card issuers"
    );
    expect(summary).toContain("since 8 March 2025");
    expect(wordCount(summary)).toBeGreaterThanOrEqual(40);
    expect(wordCount(summary)).toBeLessThanOrEqual(60);
    expect(keyFactStats(facts).map((stat) => stat.value)).toEqual([
      36, 39, 32, 33,
    ]);
  });

  test("falls back to wording without live numbers", () => {
    const summary = keyFactsSummary(null);
    expect(summary).toContain("30+ lenders");
    expect(summary).not.toMatch(/\b\d{2} mortgage lenders/u);
    expect(wordCount(summary)).toBeGreaterThanOrEqual(40);
    expect(wordCount(summary)).toBeLessThanOrEqual(60);
  });
});
