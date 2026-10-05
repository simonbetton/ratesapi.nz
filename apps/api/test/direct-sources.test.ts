import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import { load } from "cheerio";

import {
  collectDirectDataset,
  createSourceFetcher,
} from "../bin/direct/collect";
import { advertisedRate, percentage } from "../bin/direct/parsing";
import { publishDirectBatch, publishDirectDataset } from "../bin/direct/run";
import { directSources, institutions } from "../bin/direct/sources";
import type {
  BrowserReadiness,
  DirectSource,
  Institution,
} from "../bin/direct/types";
import { loadFromD1 } from "../bin/utils";
import { MortgageRates } from "../src/models/mortgage-rates";
import responses from "./fixtures/direct/responses.json";

const pages = new Map(Object.entries(responses));

function source(id: string): DirectSource {
  const found = directSources.find((item) => item.id === id);
  if (!found) {
    throw new Error(`Missing source ${id}`);
  }
  return found;
}

const registry: Institution[] = [
  {
    id: "anz",
    name: "ANZ",
    datasets: {
      "mortgage-rates": {
        status: "active",
        reason: "Test",
        legacyProducts: [],
      },
    },
  },
];

async function fixtureFetch(url: string): Promise<string> {
  const response = pages.get(url);
  if (!response) {
    throw new Error(`Missing fixture ${url}`);
  }
  return response;
}

describe("direct source parsers", () => {
  test.each(directSources)(
    "$id reads captured first-party content and rejects an empty page",
    (adapter) => {
      const rates = adapter.parse(pages);
      expect(rates.length).toBeGreaterThan(0);
      expect(
        rates.every(
          (rate) =>
            Number.isFinite(rate.rate) &&
            [...adapter.urls, ...(adapter.discover?.(pages) ?? [])].includes(
              rate.sourceUrl
            )
        )
      ).toBe(true);
      expect(() =>
        adapter.parse(
          new Map(
            adapter.urls.map((url) => [
              url,
              "<html>Temporarily unavailable</html>",
            ])
          )
        )
      ).toThrow();
    }
  );

  test("ANZ matches published codes, including special rates with isfordisplay=0", () => {
    const rates = source("anz-mortgage").parse(pages);
    expect(
      rates.find(
        (rate) => rate.product === "Special" && rate.termInMonths === 12
      )?.rate
    ).toBe(4.99);
    expect(
      rates.find(
        (rate) => rate.product === "Standard" && rate.termInMonths === 12
      )?.rate
    ).toBe(5.59);
    expect(rates.find((rate) => rate.product.includes("Reno"))).toMatchObject({
      rate: 2.5,
      termInMonths: 36,
    });
    expect(
      rates.some(
        (rate) => rate.product === "Special" && rate.termInMonths === 60
      )
    ).toBe(false);
    const modified = new Map(pages);
    const feed = "https://www.anz.co.nz/bin/anzconz/rates/?format=JSON";
    const rows = JSON.parse(modified.get(feed) ?? "[]");
    rows.find((row: { code: string }) => row.code === "HFRNZ1ILE").isactive =
      "0";
    modified.set(feed, JSON.stringify(rows));
    expect(() => source("anz-mortgage").parse(modified)).toThrow("inactive");
  });

  test("ANZ converts half-yearly fees to annual fees and keeps a zero fee", () => {
    const rates = source("anz-cards").parse(pages);
    expect(
      rates.find((rate) => rate.product === "Airpoints Visa")?.primaryFeeNZD
    ).toBe(65);
    expect(
      rates.find((rate) => rate.product === "CashBack Platinum")?.primaryFeeNZD
    ).toBe(80);
    expect(
      rates.find((rate) => rate.product === "Low Rate")?.primaryFeeNZD
    ).toBe(0);
  });

  test("Kiwibank resolves first-party placeholders and deduplicates responsive tables", () => {
    const rates = source("kiwibank-mortgage").parse(pages);
    expect(rates).toHaveLength(15);
    expect(
      rates.find(
        (rate) => rate.product === "Special" && rate.termInMonths === 12
      )?.rate
    ).toBe(5.15);
    expect(rates.find((rate) => rate.product === "Offset Mortgage")?.rate).toBe(
      6.25
    );
    const cards = source("kiwibank-cards").parse(pages);
    expect(cards.find((card) => card.product === "Platinum")).toMatchObject({
      primaryFeeNZD: 50,
      interestFreePeriodInMonths: 55,
      balanceTransferPeriod: "6 months",
      balanceTransferRate: 1.99,
    });
  });

  test("a disabled Kiwibank value is never published", () => {
    const modified = new Map(pages);
    const feed = source("kiwibank-mortgage").urls[1] ?? "";
    const json = JSON.parse(modified.get(feed) ?? "{}");
    json.results.find((row: { id: number }) => row.id === 563).enabled = false;
    modified.set(feed, JSON.stringify(json));
    expect(() => source("kiwibank-mortgage").parse(modified)).toThrow(
      "disabled"
    );
  });

  test("Co-operative Bank CMS personalLoans slot is a mortgage offer, not a personal loan", () => {
    const rates = source("cooperative-mortgage").parse(pages);
    expect(
      rates.find(
        (rate) =>
          rate.product === "First Home Buyer Special" &&
          rate.termInMonths === 12
      )?.rate
    ).toBe(5.09);
    expect(
      source("cooperative-personal-loan-rates").parse(pages)[0]
    ).toMatchObject({ rate: 9.95, rateMaximum: 17.75, rateType: "range" });
    expect(source("cooperative-cards").parse(pages)[0]).toMatchObject({
      primaryFeeNZD: 20,
      balanceTransferRate: 0,
      interestFreePeriodInMonths: 55,
    });
  });

  test("lending tables exclude deposit returns and default interest", () => {
    const sbs = source("sbs-mortgage").parse(pages);
    expect(sbs).toHaveLength(20);
    expect(
      sbs.find((rate) => rate.product === "Special" && rate.termInMonths === 12)
        ?.rate
    ).toBe(4.99);
    expect(sbs.some((rate) => rate.product.includes("Default"))).toBe(false);
    expect(
      sbs.find((rate) => rate.product === "Construction lending for FHB")
    ).toMatchObject({ rate: 3.79, termInMonths: null });
    expect(
      source("heartland-personal")
        .parse(pages)
        .find((rate) => rate.product === "YouChoose Overdraft")?.rate
    ).toBe(10);
    expect(
      source("nbs-mortgage")
        .parse(pages)
        .find(
          (rate) => rate.product === "Residential" && rate.termInMonths === 12
        )?.rate
    ).toBe(5.19);
  });

  test("loan ranges retain their upper bound and security", () => {
    expect(source("toyota-personal-loan-rates").parse(pages)[0]).toMatchObject({
      rate: 12.95,
      rateMaximum: 19.95,
      rateType: "range",
    });
    expect(
      source("toyota-car-loan-rates")
        .parse(pages)
        .map((rate) => rate.product)
    ).toEqual([
      "Credit Contract",
      "Variable Rate Credit Contract",
      "Credit Contract Marine",
    ]);
    const rates = source("mtf-finance-personal-loan-rates").parse(pages);
    expect(rates.find((rate) => rate.plan === "Secured")).toMatchObject({
      rate: 10.3,
      rateMaximum: 22.3,
      rateType: "range",
    });
    expect(rates.find((rate) => rate.plan === "Unsecured")).toMatchObject({
      rate: 13.75,
      rateMaximum: 23.75,
    });
    expect(source("police-personal-loan-rates").parse(pages)[0]).toMatchObject({
      rate: 10.5,
      rateType: "from",
    });
  });
});

describe("strict percentages", () => {
  test.each([
    "",
    "—",
    "Call us",
    "5.99 to 12.99%",
    "$5.99",
    "5.99% plus 2%",
    "NaN",
    "Infinity",
    "101%",
    "-1%",
  ])("rejects %s", (value) => {
    expect(() => percentage(value)).toThrow();
  });
  test("accepts zero and represents ranges and from rates explicitly", () => {
    expect(percentage("0% p.a.")).toBe(0);
    expect(advertisedRate("9.90% - 19.90% p.a.")).toEqual({
      rate: 9.9,
      rateMaximum: 19.9,
      rateType: "range",
    });
    expect(advertisedRate("From 10.50% p.a.")).toEqual({
      rate: 10.5,
      rateType: "from",
    });
    expect(() => advertisedRate("19.90% - 9.90% p.a.")).toThrow("Inverted");
  });
});

describe("complete dataset publication", () => {
  test("a missing product needs a reviewed mapping, including products added after migration", async () => {
    const result = await collectDirectDataset(
      "mortgage-rates",
      registry,
      [source("anz-mortgage")],
      fixtureFetch
    );
    if (!result.model || result.model.type !== "MortgageRates") {
      throw new Error("Expected mortgages");
    }
    const old = structuredClone(result.model);
    old.data[0]?.products.push({
      id: "product:anz:future-product",
      name: "Future product",
      rates: [],
    });
    let writes = 0;
    await expect(
      publishDirectDataset({
        collect: async () => result,
        load: async () => old,
        save: async () => {
          writes += 1;
          return true;
        },
        markChecked: async () => {
          writes += 1;
        },
        registry,
      })
    ).rejects.toThrow("without review");
    expect(writes).toBe(0);
  });

  test("batch publishes independent categories when another is incomplete or unreadable", async () => {
    const result = await collectDirectDataset(
      "mortgage-rates",
      registry,
      [source("anz-mortgage")],
      fixtureFetch
    );
    let writes = 0;
    let reads = 0;
    const deps = {
      collect: async () => result,
      load: async () => {
        reads += 1;
        return null;
      },
      save: async () => {
        writes += 1;
        return true;
      },
      markChecked: async () => {
        writes += 1;
      },
      registry,
    };
    await expect(
      publishDirectBatch([
        deps,
        {
          ...deps,
          collect: async () => ({
            ...result,
            blockers: ["Missing source"],
            model: null,
            publishable: null,
          }),
        },
      ])
    ).rejects.toThrow("incomplete");
    expect(reads).toBe(1);
    expect(writes).toBe(1);
    await expect(
      publishDirectBatch([
        deps,
        {
          ...deps,
          load: async () => {
            throw new Error("D1 unavailable");
          },
        },
      ])
    ).rejects.toThrow("D1 unavailable");
    expect(writes).toBe(2);
  });

  test("strict D1 reads distinguish an empty database from errors and malformed results", async () => {
    const options = {
      target: { databaseName: "test", flags: ["--local"] },
      strict: true,
    };
    await expect(
      loadFromD1("mortgage-rates", MortgageRates, {
        ...options,
        run: () => '[{"success":true,"results":[]}]',
      })
    ).resolves.toBeNull();
    await Promise.all(
      [
        '{"success":false}',
        "[]",
        '[{"results":[{"data":null}]}]',
        '[{"results":[null]}]',
      ].map((response) =>
        expect(
          loadFromD1("mortgage-rates", MortgageRates, {
            ...options,
            run: () => response,
          })
        ).rejects.toThrow()
      )
    );
    await expect(
      loadFromD1("mortgage-rates", MortgageRates, {
        ...options,
        run: () => {
          throw new Error("Offline");
        },
      })
    ).rejects.toThrow("Offline");
  });

  test("pending institutions keep the run incomplete but do not block verified institutions", async () => {
    const result = await collectDirectDataset(
      "mortgage-rates",
      [
        ...institutions,
        {
          id: "unreviewed-lender",
          name: "Unreviewed lender",
          datasets: {
            "mortgage-rates": {
              status: "pending",
              reason: "Review required",
              legacyProducts: [],
            },
          },
        },
      ],
      directSources,
      fixtureFetch
    );
    expect(result.sources.every((item) => item.status === "ok")).toBe(true);
    expect(result.preview?.data.length).toBeGreaterThan(0);
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.model).toBeNull();
    let writes = 0;
    await expect(
      publishDirectDataset({
        collect: async () => result,
        load: async () => null,
        save: async () => {
          writes += 1;
          return true;
        },
        markChecked: async () => {
          writes += 1;
        },
        registry: institutions,
      })
    ).rejects.toThrow("partial publication saved");
    expect(writes).toBe(1);
  });

  test("an HTTP failure keeps the previous data and freshness timestamp untouched", async () => {
    const result = await collectDirectDataset(
      "mortgage-rates",
      registry,
      [source("anz-mortgage")],
      async () => {
        throw new Error("HTTP 403");
      }
    );
    expect(result.model).toBeNull();
    expect(result.sources[0]?.status).toBe("failed");
    expect(result.blockers.join(" ")).toContain("HTTP 403");
  });

  test("publishes validated direct data while retaining an unreviewed institution", async () => {
    const result = await collectDirectDataset(
      "mortgage-rates",
      registry,
      [source("anz-mortgage")],
      fixtureFetch
    );
    expect(result.model?.type).toBe("MortgageRates");
    expect(result.model?.data[0]?.id).toBe("institution:anz");
    let saved = 0;
    const deps = {
      collect: async () => result,
      load: async () => null,
      save: async () => {
        saved += 1;
        return true;
      },
      markChecked: async () => {},
      registry,
    };
    await expect(publishDirectDataset(deps)).resolves.toBe("saved");
    expect(saved).toBe(1);
    if (!result.model) {
      throw new Error("Expected a complete model");
    }
    const old = structuredClone(result.model);
    const [oldInstitution] = old.data;
    if (!oldInstitution) {
      throw new Error("Expected an institution");
    }
    oldInstitution.id = "institution:unexpected";
    await expect(
      publishDirectDataset({ ...deps, load: async () => old })
    ).rejects.toThrow("retained previous data");
    expect(saved).toBe(2);
    await expect(
      publishDirectDataset({ ...deps, load: async () => result.model })
    ).resolves.toBe("unchanged");
    expect(saved).toBe(2);
    await expect(
      publishDirectDataset({ ...deps, save: async () => false })
    ).rejects.toThrow("Failed to save");
    await expect(
      publishDirectDataset({
        ...deps,
        load: async () => result.model,
        markChecked: async () => {
          throw new Error("Check write failed");
        },
      })
    ).rejects.toThrow("Check write failed");
  });

  test("duplicate observations are rejected instead of overwriting IDs", async () => {
    const adapter = source("anz-mortgage");
    const result = await collectDirectDataset(
      "mortgage-rates",
      registry,
      [
        {
          ...adapter,
          parse: (input) => {
            const rates = adapter.parse(input);
            return [...rates, ...rates];
          },
        },
      ],
      fixtureFetch
    );
    expect(result.model).toBeNull();
    expect(result.blockers.join(" ")).toContain("Duplicate");
  });
});

describe("first-party fetch boundary", () => {
  test("shares a request within a run", async () => {
    let requests = 0;
    const fetchPage = createSourceFetcher(async () => {
      requests += 1;
      return new Response("rate data");
    });
    await Promise.all([
      fetchPage("https://bank.example/rates"),
      fetchPage("https://bank.example/rates"),
    ]);
    expect(requests).toBe(1);
  });

  test("rejects non-HTTPS sources and unapproved redirects", async () => {
    let requests = 0;
    const fetchPage = createSourceFetcher(async () => {
      requests += 1;
      return new Response(null, {
        status: 302,
        headers: { location: "https://other.example/rates" },
      });
    });
    await expect(fetchPage("http://bank.example/rates")).rejects.toThrow(
      "Not an allowed"
    );
    expect(requests).toBe(0);
    await expect(fetchPage("https://bank.example/rates")).rejects.toThrow(
      "Unapproved"
    );
    expect(requests).toBe(1);
  });
});

describe("rendered major-bank rate tables", () => {
  test("ASB reads the populated rate, not its embedded default or low-equity margins", () => {
    const rates = source("asb-mortgage").parse(pages);
    expect(rates).toHaveLength(11);
    expect(
      rates.find(
        (rate) => rate.product === "Standard" && rate.termInMonths === null
      )?.rate
    ).toBe(6.29);
    expect(
      rates.find((rate) => rate.product === "Better Homes Top Up")
    ).toMatchObject({ rate: 1, termInMonths: 36 });
  });

  test("BNZ maps named columns and rejects a reordered product header", () => {
    const rates = source("bnz-mortgage").parse(pages);
    expect(rates).toHaveLength(12);
    expect(rates.find((rate) => rate.product === "TotalMoney")?.rate).toBe(
      6.44
    );
    expect(
      rates.find(
        (rate) => rate.product === "Standard" && rate.termInMonths === null
      )?.rate
    ).toBe(6.34);
    const url = source("bnz-mortgage").urls[0] ?? "";
    const changed = new Map([
      ...pages,
      [
        url,
        (pages.get(url) ?? "").replaceAll("TotalMoney", "Unexpected column"),
      ],
    ]);
    expect(() => source("bnz-mortgage").parse(changed)).toThrow(
      "columns changed"
    );
  });

  test("Westpac excludes old floating rates in prose and preserves a genuine zero-interest offer", () => {
    const rates = source("westpac-mortgage").parse(pages);
    expect(rates).toHaveLength(18);
    expect(
      rates.find(
        (rate) => rate.product === "Standard" && rate.termInMonths === null
      )?.rate
    ).toBe(6.39);
    expect(
      rates.find((rate) => rate.product === "Greater Choices")
    ).toMatchObject({ rate: 0, termInMonths: 60 });
    expect(rates.some((rate) => rate.rate === 6.14)).toBe(false);
  });

  test("unpopulated browser cells fail extraction instead of producing a zero rate", () => {
    const adapter = source("asb-mortgage");
    const url = adapter.urls[0] ?? "";
    const changed = new Map([
      ...pages,
      [url, (pages.get(url) ?? "").replaceAll("4.79%", "%")],
    ]);
    expect(() => adapter.parse(changed)).toThrow("Expected one percentage");
  });
});

describe("TSB mortgage disclosure", () => {
  test("personal lending excludes default interest and preserves the existing-customer restriction", () => {
    const rates = source("tsb-personal").parse(pages);
    expect(rates).toHaveLength(2);
    expect(rates[0]).toMatchObject({ product: "Personal loan", rate: 12.95 });
    expect(rates[0]?.condition).toContain("Existing customers only");
    expect(rates[1]).toMatchObject({
      product: "Overdraft facilities",
      rate: 15.39,
    });
    const url = "https://www.tsb.co.nz/rates-fees-agreements/personal-loans";
    const changed = new Map([
      ...pages,
      [
        url,
        (pages.get(url) ?? "").replace(
          "Fixed interest rate",
          "Other interest rate"
        ),
      ],
    ]);
    expect(() => source("tsb-personal").parse(changed)).toThrow(
      "Expected one match"
    );
  });

  test("card disclosure keeps purchase rates, cash advances and annual fees distinct", () => {
    expect(source("tsb-cards").parse(pages)).toEqual([
      {
        product: "Low Rate",
        rate: 11.95,
        cashAdvanceRate: 11.95,
        primaryFeeNZD: 20,
        sourceUrl:
          "https://www.tsb.co.nz/rates-fees-agreements/credit-mastercard",
      },
      {
        product: "Platinum",
        rate: 20.95,
        cashAdvanceRate: 22.95,
        primaryFeeNZD: 90,
        sourceUrl:
          "https://www.tsb.co.nz/rates-fees-agreements/credit-mastercard",
      },
    ]);
    const url = source("tsb-cards").urls[0] ?? "";
    const changed = new Map([
      ...pages,
      [url, (pages.get(url) ?? "").replace("22.95% p.a.", "-")],
    ]);
    expect(() => source("tsb-cards").parse(changed)).toThrow(
      "Expected one percentage"
    );
  });

  test("keeps special and standard columns separate, including floating and revolving loans", () => {
    const rates = source("tsb-mortgage").parse(pages);
    expect(rates).toHaveLength(17);
    expect(
      rates.find(
        (rate) => rate.product === "Special" && rate.termInMonths === 12
      )?.rate
    ).toBe(5.19);
    expect(
      rates.find(
        (rate) => rate.product === "Standard" && rate.termInMonths === 12
      )?.rate
    ).toBe(5.99);
    expect(
      rates.find((rate) => rate.product === "Revolving Credit")
    ).toMatchObject({ rate: 6.39, termInMonths: null });
    expect(rates.every((rate) => rate.rate > 0)).toBe(true);
  });

  test("rejects missing rows and changed tier labels instead of accepting partial coverage", () => {
    const adapter = source("tsb-mortgage");
    const url = adapter.urls[0] ?? "";
    const html = pages.get(url) ?? "";
    const changed = new Map([
      ...pages,
      [url, html.replaceAll("Minimum 20% deposit", "Minimum 30% deposit")],
    ]);
    expect(() => adapter.parse(changed)).toThrow(
      "TSB mortgage columns changed"
    );
    const missing = new Map([
      ...pages,
      [url, html.replace(/<tr[^>]*>[\s\S]*?6 months[\s\S]*?<\/tr>/u, "")],
    ]);
    expect(() => adapter.parse(missing)).toThrow();
  });
});

describe("document and expanded-source safeguards", () => {
  test.each([
    "mortgage-rates",
    "personal-loan-rates",
    "car-loan-rates",
    "credit-card-rates",
  ] as const)("the reviewed %s catalogue is complete", async (dataset) => {
    const result = await collectDirectDataset(
      dataset,
      institutions,
      directSources,
      fixtureFetch
    );
    expect(result.blockers).toEqual([]);
    expect(result.model).not.toBeNull();
  });

  test("Baroda consumer rates follow the published base plus margin, and India preserves its schedule date", () => {
    const adapter = source("baroda-car-loan-rates");
    expect(adapter.parse(pages)[0]?.rate).toBe(11.24);
    const url = adapter.urls[0] ?? "";
    const modified = new Map([
      ...pages,
      [url, (pages.get(url) ?? "").replaceAll("7.24%", "6.24%")],
    ]);
    expect(adapter.parse(modified)[0]?.rate).toBe(10.24);
    const india = source("bank-of-india-mortgage").parse(pages);
    expect(india).toHaveLength(5);
    expect(india[0]?.condition).toContain("01/03/2023");
    expect(india.some((rate) => rate.product.includes("Business"))).toBe(false);
  });

  test("newly discovered loans distinguish interest from deposit percentages and resolve the document base URL", () => {
    const ministry = source("christian-savings-mortgage").parse(pages);
    expect(ministry.map((rate) => [rate.termInMonths, rate.rate])).toEqual([
      [12, 4.8],
      [null, 5.45],
    ]);
    const gold = source("gold-band-personal-loan-rates");
    expect(gold.discover?.(pages)).toEqual([
      "https://goldbandfinance.nz/assets/files/schedule-of-interest_rates_standard-charges-gold-band-finance.pdf",
    ]);
    expect(gold.parse(pages)[0]).toMatchObject({
      rate: 6.99,
      rateMaximum: 25,
      rateType: "range",
    });
  });

  test("extracts a real first-party PDF and rejects a disguised HTML response", async () => {
    const pdf = await readFile(
      new URL("fixtures/direct/liberty-disclosure.pdf", import.meta.url)
    );
    const fetchPage = createSourceFetcher(
      async () =>
        new Response(pdf, { headers: { "content-type": "application/pdf" } })
    );
    const result = JSON.parse(
      await fetchPage("https://bank.example/current.pdf")
    );
    expect(result.type).toBe("pdf");
    expect(result.text).toContain("Prime");
    const invalid = createSourceFetcher(
      async () =>
        new Response("<html>Access denied</html>", {
          headers: { "content-type": "application/pdf" },
        })
    );
    await expect(invalid("https://bank.example/current.pdf")).rejects.toThrow(
      "Invalid or oversized PDF"
    );
  });

  test("discovered documents require approved origins before making a request", async () => {
    const requested: string[] = [];
    const adapter: DirectSource = {
      id: "test-document",
      institution: "anz",
      dataset: "mortgage-rates",
      urls: ["https://bank.example/rates"],
      discover: () => ["https://unapproved.example/rates.pdf"],
      discoveredBrowser: { selector: "td", minimumRates: 1 },
      parse: () => [
        {
          product: "Standard",
          rate: 5,
          sourceUrl: "https://unapproved.example/rates.pdf",
          termInMonths: 12,
        },
      ],
    };
    const fetchPage = async (url: string) => {
      requested.push(url);
      return "document";
    };
    const rejected = await collectDirectDataset(
      "mortgage-rates",
      registry,
      [adapter],
      fetchPage
    );
    expect(rejected.model).toBeNull();
    expect(requested).toEqual(["https://bank.example/rates"]);
    const accepted = await collectDirectDataset(
      "mortgage-rates",
      registry,
      [{ ...adapter, documentOrigins: ["https://unapproved.example"] }],
      fetchPage
    );
    expect(accepted.blockers).toEqual([]);
    expect(accepted.sources[0]?.urls).toContain(
      "https://unapproved.example/rates.pdf"
    );
  });

  test("follows the currently linked disclosure instead of a pinned historical PDF", () => {
    const adapter = source("liberty-mortgage");
    const index = adapter.urls[0] ?? "";
    const original = adapter.discover?.(pages)[0] ?? "";
    const next = original.replace("/x/", "/updated/");
    const modified = new Map([
      ...pages,
      [index, (pages.get(index) ?? "").replaceAll(original, next)],
      [next, pages.get(original) ?? ""],
    ]);
    expect(adapter.discover?.(modified)).toEqual([next]);
    expect(
      adapter.parse(modified).every((rate) => rate.sourceUrl === next)
    ).toBe(true);
  });

  test("Bank of China renders the latest linked disclosure with the reviewed browser readiness", async () => {
    const adapter = source("bank-of-china-mortgage");
    const original = adapter.discover?.(pages)[0] ?? "";
    const index = adapter.urls[0] ?? "";
    const readiness = adapter.discoveredBrowser;
    if (!readiness || !("selector" in readiness)) {
      throw new Error("Bank of China must render its disclosure table");
    }
    const $ = load(pages.get(original) ?? "");
    const ratePattern = new RegExp(readiness.rateTextPattern ?? "", "u");
    expect(
      $(readiness.selector)
        .toArray()
        .filter((cell) => ratePattern.test($(cell).text().trim())).length
    ).toBe(readiness.minimumRates);
    const next = original.replaceAll("20260820", "20260821");
    const modified = new Map([
      ...pages,
      [index, (pages.get(index) ?? "").replaceAll("20260820", "20260821")],
      [next, pages.get(original) ?? ""],
    ]);
    const requests: { url: string; readiness?: BrowserReadiness }[] = [];
    const result = await collectDirectDataset(
      "mortgage-rates",
      institutions.filter((institution) => institution.id === "bank-of-china"),
      [adapter],
      async (url, browserReadiness) => {
        requests.push({ url, readiness: browserReadiness });
        return modified.get(url) ?? "";
      }
    );
    expect(result.blockers).toEqual([]);
    expect(requests[1]).toEqual({
      url: next,
      readiness: adapter.discoveredBrowser,
    });
    expect(result.sources[0]?.urls).toContain(next);
    expect(result.sources[0]?.urls).not.toContain(original);
  });

  test("PDF loan ranges retain both endpoints and do not turn fixed term ranges into floating loans", () => {
    expect(source("basecorp-mortgage").parse(pages)[0]).toMatchObject({
      rate: 7.5,
      rateMaximum: 9.5,
      rateType: "range",
      term: "By agreement",
    });
    expect(source("xceda-mortgage").parse(pages)[0]).toMatchObject({
      rate: 7.5,
      rateMaximum: 13.9,
      rateType: "range",
      term: "Fixed for 3–18 months",
    });
    expect(
      source("cfml-mortgage")
        .parse(pages)
        .find((rate) => rate.product === "321 Loan")?.rate
    ).toBe(7.2);
  });

  test("Resimac rejects changed product and term columns", () => {
    const adapter = source("resimac-mortgage");
    expect(adapter.parse(pages)).toHaveLength(68);
    const url = adapter.urls[0] ?? "";
    for (const label of ["Clear", "1 year", "Standard Prime Full Doc Rates."]) {
      const $ = load(pages.get(url) ?? "");
      const cell = $("h2, .resimac-library--table_row_layout > div")
        .filter((_, e) => $(e).text().trim() === label)
        .first();
      expect(cell.length).toBe(1);
      cell.text("Changed column");
      expect(() =>
        adapter.parse(new Map([...pages, [url, $.html()]]))
      ).toThrow();
    }
  });

  test("Lending Crowd only accepts personal tables with matching security grades", () => {
    const adapter = source("lending-crowd-personal");
    expect(adapter.parse(pages)).toHaveLength(45);
    const url = adapter.urls[0] ?? "";
    const modified = new Map([
      ...pages,
      [url, (pages.get(url) ?? "").replaceAll("A1-U", "A1-S")],
    ]);
    expect(() => adapter.parse(modified)).toThrow("credit grades");
  });

  test("Westpac card rates are matched by name even when the row order changes", () => {
    const adapter = source("westpac-cards");
    const url = adapter.urls[0] ?? "";
    const $ = load(pages.get(url) ?? "");
    const rows = $("tr")
      .toArray()
      .filter((row) => $(row).text().includes("%"));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      $(row).parent().prepend(row);
    }
    expect(adapter.parse(new Map([...pages, [url, $.html()]]))).toEqual(
      adapter.parse(pages)
    );
  });

  test("card eligibility and promotion conditions survive model construction", async () => {
    const adapter = source("amex-cards");
    const selected = institutions.filter(
      (institution) => institution.id === "amex"
    );
    const result = await collectDirectDataset(
      "credit-card-rates",
      selected,
      [adapter],
      fixtureFetch
    );
    expect(result.blockers).toEqual([]);
    expect(JSON.stringify(result.model)).toContain("first 6 months");
  });
});
