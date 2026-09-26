import { describe, expect, test } from "bun:test";

import { pickMonthlySnapshots, toRows } from "../src/lib/rates-data";
import type { ApiRates } from "../src/lib/rates-data";
import {
  defaultFilters,
  filterRows,
  historySeries,
  lowestKeys,
  providerRanking,
  sortRows,
  summarize,
  termCurve,
} from "../src/lib/rates-stats";
import { siteOrigins } from "../src/lib/site-urls";

const mortgages: ApiRates = {
  type: "MortgageRates",
  lastUpdated: "2026-09-25T01:20:30.582Z",
  data: [
    {
      id: "institution:anz",
      name: "ANZ",
      products: [
        {
          id: "product:anz:special",
          name: "Special",
          rates: [
            {
              id: "rate:anz:special:1-year",
              rate: 4.69,
              term: "1 year",
              termInMonths: 12,
            },
            {
              id: "rate:anz:special:2-years",
              rate: 4.99,
              term: "2 years",
              termInMonths: 24,
            },
          ],
        },
        {
          id: "product:anz:standard",
          name: "Standard",
          rates: [
            {
              id: "rate:anz:standard:floating",
              rate: 6.29,
              term: "Variable floating",
              termInMonths: null,
            },
            {
              id: "rate:anz:standard:1-year",
              rate: 5.59,
              term: "1 year",
              termInMonths: 12,
            },
          ],
        },
      ],
    },
    {
      id: "institution:kiwibank",
      name: "Kiwibank",
      products: [
        {
          id: "product:kiwibank:special",
          name: "Special",
          rates: [
            {
              id: "rate:kiwibank:special:1-year",
              rate: 4.69,
              term: "1 year",
              termInMonths: 12,
            },
            {
              id: "rate:kiwibank:special:2-years",
              rate: 4.89,
              term: "2 years",
              termInMonths: 24,
            },
          ],
        },
      ],
    },
  ],
};

const rows = toRows("mortgage", mortgages);

function cardIssuer(id: string, name: string, purchaseRate = 20.95) {
  return {
    id,
    name,
    plans: [
      {
        id: `plan:${id}:${purchaseRate}`,
        name: `${name} Visa`,
        interestFreePeriodInMonths: null,
        primaryFeeNZD: null,
        balanceTransferRate: null,
        balanceTransferPeriod: null,
        cashAdvanceRate: null,
        purchaseRate,
      },
    ],
  };
}

describe("site origins", () => {
  test("links to each local dev server in development", () => {
    expect(siteOrigins(true)).toEqual({
      api: "http://localhost:8787",
      docs: "http://localhost:3000/docs",
    });
  });

  test("links to the shared production origin otherwise", () => {
    expect(siteOrigins(false)).toEqual({
      api: "https://www.ratesapi.nz",
      docs: "https://www.ratesapi.nz/docs",
    });
  });
});

describe("rates explorer data", () => {
  test("flattens mortgages into rows grouped by term, with unique keys", () => {
    expect(rows).toHaveLength(6);
    expect(new Set(rows.map((row) => row.key)).size).toBe(6);
    expect(rows[2]).toMatchObject({
      provider: "ANZ",
      product: "Standard",
      term: "Variable floating",
      termInMonths: null,
      rate: 6.29,
      group: "Variable floating",
    });
  });

  test("treats a 0% mortgage or loan rate as missing", () => {
    const [row] = toRows("mortgage", {
      ...mortgages,
      data: [
        {
          id: "institution:westpac",
          name: "Westpac",
          products: [
            {
              id: "product:westpac:greater-choices",
              name: "Greater Choices",
              rates: [
                {
                  id: "rate:westpac:greater-choices:5-years",
                  rate: 0,
                  term: "5 years",
                  termInMonths: 60,
                },
              ],
            },
          ],
        },
      ],
    });
    expect(row?.rate).toBeNull();
  });

  test("leaves out cards with a 0% purchase rate, such as debit cards", () => {
    const cards = toRows("credit-card", {
      type: "CreditCardRates",
      lastUpdated: "2026-09-25T00:00:00.000Z",
      data: [
        cardIssuer("issuer:asb", "ASB", 0),
        cardIssuer("issuer:asb", "ASB"),
      ],
    });
    expect(cards.map((card) => card.rate)).toEqual([20.95]);
  });

  test("reads credit card interest-free periods as days", () => {
    const [card] = toRows("credit-card", {
      type: "CreditCardRates",
      lastUpdated: "2026-09-25T00:00:00.000Z",
      data: [
        {
          id: "issuer:amex",
          name: "Amex",
          plans: [
            {
              id: "plan:amex:airpoints-card",
              name: "Airpoints Card",
              interestFreePeriodInMonths: 55,
              primaryFeeNZD: 149,
              balanceTransferRate: 2.99,
              balanceTransferPeriod: "6 months",
              cashAdvanceRate: 21.95,
              purchaseRate: 19.95,
            },
          ],
        },
      ],
    });
    expect(card).toMatchObject({
      rate: 19.95,
      interestFreeDays: 55,
      fee: 149,
      balanceTransferRate: 2.99,
    });
  });

  test("maps each month to the newest stored snapshot on or before it", () => {
    const available = [
      "2025-09-20",
      "2025-10-02",
      "2026-07-19",
      "2026-08-30",
      "2026-09-25",
    ];
    expect(pickMonthlySnapshots(available, "2026-09-25", 3)).toEqual([
      // Rates did not change between 2 Oct 2025 and 19 Jul 2026.
      { date: "2026-06-25", snapshot: "2025-10-02" },
      { date: "2026-07-25", snapshot: "2026-07-19" },
      { date: "2026-08-25", snapshot: "2026-07-19" },
    ]);
    // Months before the first stored snapshot have no point.
    expect(pickMonthlySnapshots(["2026-08-30"], "2026-09-25", 3)).toEqual([]);
  });
});

describe("rates explorer stats", () => {
  test("filters by term, search text, and specials", () => {
    const oneYear = filterRows(rows, defaultFilters("mortgage"));
    expect(oneYear.map((row) => row.rate)).toEqual([4.69, 5.59, 4.69]);

    const search = filterRows(rows, {
      ...defaultFilters("mortgage"),
      term: "",
      query: "kiwi",
    });
    expect(search.every((row) => row.provider === "Kiwibank")).toBe(true);

    const specials = filterRows(rows, {
      ...defaultFilters("mortgage"),
      term: "",
      specialsOnly: true,
    });
    expect(specials.every((row) => row.product === "Special")).toBe(true);
  });

  test("keeps only the Big 5 banks, as lenders and as card issuers", () => {
    const lenderRows = toRows("mortgage", {
      ...mortgages,
      data: [
        ...mortgages.data,
        {
          id: "institution:sbs-bank",
          name: "SBS Bank",
          products: [
            {
              id: "product:sbs-bank:standard",
              name: "Standard",
              rates: [
                {
                  id: "rate:sbs-bank:standard:1-year",
                  rate: 4.49,
                  term: "1 year",
                  termInMonths: 12,
                },
              ],
            },
          ],
        },
      ],
    });
    const bigFive = filterRows(lenderRows, {
      ...defaultFilters("mortgage"),
      bigFiveOnly: true,
    });
    expect(new Set(bigFive.map((row) => row.provider))).toEqual(
      new Set(["ANZ", "Kiwibank"])
    );

    const cardRows = toRows("credit-card", {
      type: "CreditCardRates",
      lastUpdated: mortgages.lastUpdated,
      data: [
        cardIssuer("issuer:asb", "ASB"),
        cardIssuer("issuer:amex", "Amex"),
      ],
    });
    expect(
      filterRows(cardRows, {
        ...defaultFilters("credit-card"),
        bigFiveOnly: true,
      }).map((row) => row.provider)
    ).toEqual(["ASB"]);
  });

  test("badges every row tied for the lowest rate in its term", () => {
    const badges = lowestKeys(rows, (row) => row.rate);
    const badged = rows.filter((row) => badges.has(row.key));
    expect(
      badged.map((row) => `${row.provider} ${row.term} ${row.rate}`)
    ).toEqual([
      "ANZ 1 year 4.69",
      "ANZ Variable floating 6.29",
      "Kiwibank 1 year 4.69",
      "Kiwibank 2 years 4.89",
    ]);
  });

  test("sorts by column in either direction with missing values last", () => {
    const byTerm = sortRows(rows, { key: "term", direction: "asc" });
    expect(byTerm[0]?.term).toBe("Variable floating");

    const withMissing = [...rows, { ...rows[0], key: "missing", rate: null }];
    for (const direction of ["asc", "desc"] as const) {
      const sorted = sortRows(withMissing, { key: "rate", direction });
      expect(sorted.at(-1)?.key).toBe("missing");
    }
    const descending = sortRows(rows, { key: "rate", direction: "desc" });
    expect(descending[0]?.rate).toBe(6.29);
  });

  test("summarises, ranks providers, and builds the term curve", () => {
    const summary = summarize(rows);
    expect(summary.lowest?.rate).toBe(4.69);
    expect(summary.median).toBeCloseTo(4.94);
    expect(summary.providers).toBe(2);

    expect(
      providerRanking(rows, 5).map((row) => [row.provider, row.rate])
    ).toEqual([
      ["ANZ", 4.69],
      ["Kiwibank", 4.69],
    ]);

    const curve = termCurve(rows);
    expect(curve.map((point) => point.short)).toEqual([
      "Float",
      "6m",
      "1y",
      "18m",
      "2y",
      "3y",
      "4y",
      "5y",
    ]);
    expect(curve[2]).toMatchObject({ lowest: 4.69, median: 4.69 });
    expect(curve[1]).toMatchObject({ lowest: null, median: null });
  });

  test("applies the filters to every history snapshot", () => {
    const points = historySeries(
      [
        {
          date: "2026-08-25",
          rows: rows.map((row) => ({ ...row, rate: (row.rate ?? 0) + 1 })),
        },
        { date: "2026-09-25", rows },
      ],
      defaultFilters("mortgage")
    );
    expect(points.map((point) => point.date)).toEqual([
      "2026-08-25",
      "2026-09-25",
    ]);
    expect(points[0]?.lowest).toBeCloseTo(5.69);
    expect(points[0]?.median).toBeCloseTo(5.69);
    expect(points[1]).toMatchObject({ lowest: 4.69, median: 4.69 });
  });
});
