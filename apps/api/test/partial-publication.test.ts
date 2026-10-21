import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";

import { collectDirectDataset, schemas } from "../bin/direct/collect";
import type { CollectionResult } from "../bin/direct/collect";
import {
  page,
  percentage,
  plainText,
  requiredMatch,
} from "../bin/direct/parsing";
import type { PublishDependencies } from "../bin/direct/run";
import { publishDirectBatch, publishDirectDataset } from "../bin/direct/run";
import type { DirectSource, Institution } from "../bin/direct/types";
import { loadFromD1, markCheckedInD1, saveToD1 } from "../bin/utils";
import type { D1SaveDeps } from "../bin/utils";
import { toSavableJson } from "../src/lib/data-loader";
import type { DataType, SupportedModels } from "../src/lib/data-loader";
import { MortgageRates } from "../src/models/mortgage-rates";

const registry: Institution[] = ["anz", "midlands"].map((id) => ({
  id,
  name: id,
  datasets: {
    "mortgage-rates": {
      status: "active",
      reason: "Test source",
      legacyProducts: [],
    },
  },
}));

function adapter(id: string, rate = 5): DirectSource {
  const url = `https://${id}.example/rates`;
  return {
    id: `${id}-mortgage`,
    institution: id,
    dataset: "mortgage-rates",
    urls: [url],
    parse: () => [
      { product: "Standard", rate, termInMonths: 12, sourceUrl: url },
    ],
  };
}

async function collect(sources: DirectSource[], failedHost?: string) {
  return collectDirectDataset(
    "mortgage-rates",
    registry,
    sources,
    async (url) => {
      if (new URL(url).hostname === failedHost) {
        throw new Error("HTTP 403");
      }
      return "rates";
    },
    new Date("2026-10-05T08:00:00.000Z")
  );
}

async function previousModel(): Promise<MortgageRates> {
  const result = await collect([adapter("anz"), adapter("midlands", 6)]);
  if (!result.model || result.model.type !== "MortgageRates") {
    throw new Error("Expected complete fixture");
  }
  return { ...result.model, lastUpdated: "2026-10-04T08:00:00.000Z" };
}

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Missing test fixture");
  }
  return value;
}

function persistence(
  result: CollectionResult,
  previous: SupportedModels | null
) {
  const state = { stored: previous, saves: 0, checks: 0, complete: false };
  const deps: PublishDependencies = {
    collect: async () => result,
    load: async () => state.stored,
    save: async (model, options) => {
      state.stored = model;
      state.saves += 1;
      state.complete = options.complete;
      return true;
    },
    markChecked: async () => {
      state.checks += 1;
    },
    registry,
  };
  return { state, deps };
}

describe("partial institution publication", () => {
  test("saves healthy mortgage changes while retaining failed Midlands data and freshness", async () => {
    const previous = await previousModel();
    let stored: SupportedModels = previous;
    let completeCheck: boolean | undefined;
    let checks = 0;
    const result = await collect(
      [adapter("anz", 5.5), adapter("midlands", 7)],
      "midlands.example"
    );
    await expect(
      publishDirectDataset({
        collect: async () => result,
        load: async () => stored,
        save: async (model, options) => {
          stored = model;
          completeCheck = options.complete;
          return true;
        },
        markChecked: async () => {
          checks += 1;
        },
        registry,
      })
    ).rejects.toThrow("midlands-mortgage: HTTP 403");
    expect(
      stored.data.find((item) => item.id === "institution:midlands")
    ).toEqual(previous.data.find((item) => item.id === "institution:midlands"));
    expect(
      JSON.stringify(stored.data.find((item) => item.id === "institution:anz"))
    ).toContain('"rate":5.5');
    expect(stored.lastUpdated).toBe("2026-10-04T08:00:00.000Z");
    expect(completeCheck).toBe(false);
    expect(checks).toBe(0);
  });
});

describe("publication isolation and recovery", () => {
  test("one failing source prevents a partial replacement of its own institution", async () => {
    const previous = await previousModel();
    const secondary = {
      ...adapter("midlands", 7),
      id: "midlands-secondary",
      urls: ["https://secondary.example/rates"],
    };
    const result = await collect(
      [adapter("anz", 5.5), adapter("midlands", 7), secondary],
      "secondary.example"
    );
    const { state, deps } = persistence(result, previous);
    await expect(publishDirectDataset(deps)).rejects.toThrow(
      "midlands-secondary"
    );
    expect(result.publishable?.data.map((item) => item.id)).toEqual([
      "institution:anz",
    ]);
    expect(state.stored?.data[1]).toEqual(previous.data[1]);
    expect(state.saves).toBe(1);
  });

  test.each(["duplicates", "invalid schema", "legacy product"])(
    "%s quarantines only the affected institution",
    async (failure) => {
      const previous = await previousModel();
      const midlands = adapter("midlands", 7);
      const original = midlands.parse;
      if (failure === "duplicates") {
        midlands.parse = (pages) => [...original(pages), ...original(pages)];
      } else if (failure === "invalid schema") {
        midlands.parse = (pages) =>
          original(pages).map((item) => ({ ...item, term: "Unexpected term" }));
      }
      const selected = structuredClone(registry);
      const coverage = selected[1]?.datasets["mortgage-rates"];
      if (failure === "legacy product" && coverage) {
        coverage.legacyProducts = ["Missing legacy product"];
      }
      const result = await collectDirectDataset(
        "mortgage-rates",
        selected,
        [adapter("anz", 5.5), midlands],
        async () => "rates"
      );
      const { state, deps } = persistence(result, previous);
      await expect(publishDirectDataset(deps)).rejects.toThrow(
        "partial publication saved"
      );
      expect(result.publishable?.data.map((item) => item.id)).toEqual([
        "institution:anz",
      ]);
      expect(state.stored?.data[1]).toEqual(previous.data[1]);
    }
  );

  test("a missing stored product retains that entire institution while peers save", async () => {
    const previous = await previousModel();
    if (previous.type !== "MortgageRates") {
      throw new Error("Expected mortgages");
    }
    previous.data[1]?.products.push({
      id: "product:midlands:new",
      name: "New product",
      rates: [],
    });
    const result = await collect([adapter("anz", 5.5), adapter("midlands", 7)]);
    const { state, deps } = persistence(result, previous);
    await expect(publishDirectDataset(deps)).rejects.toThrow("without review");
    expect(state.stored?.data[1]).toEqual(previous.data[1]);
    expect(JSON.stringify(state.stored?.data[0])).toContain('"rate":5.5');
    expect(state.complete).toBe(false);
  });

  test("an unknown stored institution is retained and prevents complete-check freshness", async () => {
    const previous = await previousModel();
    const unknown = structuredClone(previous.data[1]);
    if (
      !unknown ||
      previous.type !== "MortgageRates" ||
      !("products" in unknown)
    ) {
      throw new Error("Expected mortgages");
    }
    unknown.id = "institution:unknown";
    previous.data.push(unknown);
    const result = await collect([adapter("anz", 5.5), adapter("midlands", 7)]);
    const { state, deps } = persistence(result, previous);
    await expect(publishDirectDataset(deps)).rejects.toThrow(
      "institution:unknown: retained"
    );
    expect(state.stored?.data.find((item) => item.id === unknown.id)).toEqual(
      unknown
    );
    expect(state.complete).toBe(false);
  });

  test("partial unchanged and all-failed collections leave stored data and freshness untouched", async () => {
    const previous = await previousModel();
    const partial = await collect(
      [adapter("anz"), adapter("midlands")],
      "midlands.example"
    );
    const { state, deps } = persistence(partial, previous);
    await expect(publishDirectDataset(deps)).rejects.toThrow(
      "partial publication unchanged"
    );
    expect(state).toMatchObject({ stored: previous, saves: 0, checks: 0 });
    const failed = await collectDirectDataset(
      "mortgage-rates",
      registry,
      [adapter("anz"), adapter("midlands")],
      async () => {
        throw new Error("Offline");
      }
    );
    await expect(
      publishDirectDataset({ ...deps, collect: async () => failed })
    ).rejects.toThrow("incomplete");
    expect(state).toMatchObject({ stored: previous, saves: 0, checks: 0 });
  });

  test("a partial first collection saves healthy institutions without claiming a complete check", async () => {
    const result = await collect(
      [adapter("anz"), adapter("midlands")],
      "midlands.example"
    );
    const { state, deps } = persistence(result, null);
    await expect(publishDirectDataset(deps)).rejects.toThrow(
      "partial publication saved"
    );
    expect(state.stored?.data.map((item) => item.id)).toEqual([
      "institution:anz",
    ]);
    expect(state.complete).toBe(false);
  });

  test("duplicate stored institution IDs fail closed without dropping records", async () => {
    const previous = await previousModel();
    const duplicate = structuredClone(previous.data[1]);
    if (!duplicate) {
      throw new Error("Expected Midlands");
    }
    duplicate.products.push({
      id: "product:midlands:extra",
      name: "Extra",
      rates: [],
    });
    previous.data.push(duplicate);
    const result = await collect(
      [adapter("anz", 5.5), adapter("midlands")],
      "midlands.example"
    );
    const { state, deps } = persistence(result, previous);
    await expect(publishDirectDataset(deps)).rejects.toThrow(
      "duplicate institution identifiers"
    );
    expect(state).toMatchObject({ stored: previous, saves: 0, checks: 0 });
  });

  test("replaces duplicate legacy rows only after reconciling every row", async () => {
    const previous = await previousModel();
    const extra = structuredClone(required(previous.data[1]));
    extra.products = [
      { id: "product:midlands:retired", name: "Retired", rates: [] },
    ];
    previous.data.push(extra);
    const result = await collect([adapter("anz", 5.5), adapter("midlands", 7)]);
    const { state, deps } = persistence(result, previous);
    // A healthy source alone does not justify silently discarding the extra row.
    await expect(publishDirectDataset(deps)).rejects.toThrow(
      "duplicate institution identifiers"
    );
    expect(state.saves).toBe(0);
    deps.registry = structuredClone(registry);
    required(
      required(deps.registry[1]).datasets["mortgage-rates"]
    ).productDecisions = {
      Retired: {
        replacements: [],
        reason: "Retired product",
        sourceUrl: "https://midlands.example/retired",
      },
    };
    await expect(publishDirectDataset(deps)).resolves.toBe("saved");
    expect(state.stored?.data.map((item) => item.id)).toEqual([
      "institution:anz",
      "institution:midlands",
    ]);
    expect(JSON.stringify(state.stored?.data[1])).toContain('"rate":7');
    expect(state.complete).toBe(true);
  });

  test.each([false, true])(
    "a missing product in either duplicate row blocks replacement (reverse=%s)",
    async (reverse) => {
      const previous = await previousModel();
      const extra = structuredClone(required(previous.data[1]));
      extra.products = [
        { id: "product:midlands:extra", name: "Extra", rates: [] },
      ];
      previous.data.push(extra);
      if (reverse) {
        previous.data.reverse();
      }
      const result = await collect([
        adapter("anz", 5.5),
        adapter("midlands", 7),
      ]);
      const { state, deps } = persistence(result, previous);
      await expect(publishDirectDataset(deps)).rejects.toThrow(
        "duplicate institution identifiers"
      );
      expect(state).toMatchObject({ stored: previous, saves: 0, checks: 0 });
    }
  );

  test.each([
    "reviewed",
    "missing source",
    "missing date",
    "missing reason",
    "pending",
  ])(
    "%s exclusion controls removal from the latest snapshot",
    async (review) => {
      const previous = await previousModel();
      const result = await collect([
        adapter("anz", 5.5),
        adapter("midlands", 7),
      ]);
      const excluded = structuredClone(required(previous.data[1]));
      excluded.id = "institution:retired";
      previous.data.push(excluded);
      const { state, deps } = persistence(result, previous);
      deps.registry = [
        ...registry,
        {
          id: "retired",
          name: "Retired lender",
          datasets: {
            "mortgage-rates": {
              status: review === "pending" ? "pending" : "excluded",
              legacyProducts: [],
              reason: review === "missing reason" ? "" : "No longer lending",
              sourceUrl:
                review === "missing source"
                  ? undefined
                  : "https://retired.example/closure",
              reviewedAt: review === "missing date" ? undefined : "2026-10-05",
            },
          },
        },
      ];
      if (review === "reviewed") {
        await expect(publishDirectDataset(deps)).resolves.toBe("saved");
        expect(state.stored?.data.some((item) => item.id === excluded.id)).toBe(
          false
        );
        expect(state.complete).toBe(true);
      } else {
        await expect(publishDirectDataset(deps)).rejects.toThrow(
          "institution:retired: retained"
        );
        expect(
          state.stored?.data.find((item) => item.id === excluded.id)
        ).toEqual(excluded);
        expect(state.complete).toBe(false);
      }
    }
  );

  test("a recovered complete collection resumes successful-check freshness", async () => {
    const previous = await previousModel();
    const result = await collect([adapter("anz"), adapter("midlands", 6)]);
    const { state, deps } = persistence(result, previous);
    await expect(publishDirectDataset(deps)).resolves.toBe("unchanged");
    expect(state.checks).toBe(1);
    expect(state.saves).toBe(0);
  });

  test.each(["collection", "read", "save"])(
    "a category %s failure does not prevent later categories from saving",
    async (failure) => {
      const result = await collect([adapter("anz"), adapter("midlands", 6)]);
      const broken = persistence(result, null);
      const healthy = persistence(result, null);
      if (failure === "collection") {
        broken.deps.collect = async () => {
          throw new Error("Collection failure");
        };
      } else if (failure === "read") {
        broken.deps.load = async () => {
          throw new Error("Read failure");
        };
      } else {
        broken.deps.save = async () => false;
      }
      await expect(
        publishDirectBatch([broken.deps, healthy.deps])
      ).rejects.toThrow("completed with errors");
      expect(healthy.state.saves).toBe(1);
      expect(healthy.state.complete).toBe(true);
      expect(broken.state.stored).toBeNull();
    }
  );
});

describe("partial publication SQL persistence", () => {
  const datasets: DataType[] = [
    "mortgage-rates",
    "personal-loan-rates",
    "car-loan-rates",
    "credit-card-rates",
  ];

  test.each(datasets)(
    "%s extraction failure preserves only the affected institution while all categories save",
    async (failedDataset) => {
      using db = new Database(":memory:");
      db.exec(`CREATE TABLE latest_data (data_type TEXT PRIMARY KEY, data TEXT NOT NULL, last_updated TEXT, last_checked TEXT);
      CREATE TABLE historical_data (data_type TEXT, date TEXT, data TEXT, UNIQUE(data_type, date));`);
      const selected: Institution[] = ["anz", "midlands"].map((id) => ({
        id,
        name: id,
        datasets: Object.fromEntries(
          datasets.map((dataset) => [
            dataset,
            {
              status: "active",
              reason: "Test source",
              legacyProducts: ["Standard"],
            },
          ])
        ),
      }));
      const sources: DirectSource[] = datasets.flatMap((dataset) =>
        selected.map(({ id }) => {
          const url = `https://${id}.example/${dataset}`;
          return {
            id: `${id}-${dataset}`,
            institution: id,
            dataset,
            urls: [url],
            parse(pages) {
              const match = requiredMatch(
                plainText(page(pages, url)),
                /^Standard rate: (?<rate>[\d.]+)%$/u
              );
              return [
                {
                  product: "Standard",
                  rate: percentage(match[1] ?? ""),
                  termInMonths: 12,
                  sourceUrl: url,
                },
              ];
            },
          };
        })
      );
      const previous = new Map(
        await Promise.all(
          datasets.map(async (dataset) => {
            const result = await collectDirectDataset(
              dataset,
              selected,
              sources,
              async () => "<p>Standard rate: 5%</p>",
              new Date("2026-10-20T08:00:00Z")
            );
            if (!result.model) {
              throw new Error(`Incomplete baseline for ${dataset}`);
            }
            const encoded = toSavableJson(result.model);
            db.query("INSERT INTO latest_data VALUES (?, ?, ?, ?)").run(
              dataset,
              encoded,
              "2026-10-20 08:00:00",
              "2026-10-20 08:00:00"
            );
            db.query("INSERT INTO historical_data VALUES (?, ?, ?)").run(
              dataset,
              "2026-10-20",
              encoded
            );
            return [dataset, result.model] as const;
          })
        )
      );
      const io: D1SaveDeps = {
        target: { databaseName: "memory-only", flags: ["--local"] },
        now: () => new Date("2026-10-21T08:00:00Z"),
        run: (_target, sql) => {
          if (sql.startsWith("SELECT")) {
            return JSON.stringify([
              { success: true, results: db.query(sql).all() },
            ]);
          }
          db.exec(sql);
          return "ok";
        },
      };
      const brokenUrl = `https://anz.example/${failedDataset}`;
      const requests: string[] = [];
      const fetchPage = async (url: string) => {
        requests.push(url);
        // HTTP succeeds, but the changed disclosure no longer matches the parser.
        return url === brokenUrl
          ? "<p>Contact us for current pricing</p>"
          : "<p>Standard rate: 7%</p>";
      };
      // A failure in the first category must not prevent later categories saving.
      const order = [
        failedDataset,
        ...datasets.filter((dataset) => dataset !== failedDataset),
      ];
      await expect(
        publishDirectBatch(
          order.map((dataset) => ({
            collect: () =>
              collectDirectDataset(
                dataset,
                selected,
                sources,
                fetchPage,
                io.now?.(),
                { retryFetchPage: fetchPage }
              ),
            load: () =>
              loadFromD1(dataset, schemas[dataset], { ...io, strict: true }),
            save: (model, options) =>
              saveToD1(model, dataset, { ...io, ...options }),
            markChecked: () => markCheckedInD1(dataset, io),
            registry: selected,
          }))
        )
      ).rejects.toThrow(`${failedDataset}: partial publication saved`);

      for (const source of sources) {
        const url = required(source.urls[0]);
        expect(requests.filter((request) => request === url)).toHaveLength(
          url === brokenUrl ? 2 : 1
        );
      }
      await Promise.all(
        datasets.map(async (dataset) => {
          const stored = await loadFromD1(dataset, schemas[dataset], {
            ...io,
            strict: true,
          });
          if (!stored) {
            throw new Error(`Missing saved ${dataset}`);
          }
          const baseline = required(previous.get(dataset));
          expect(stored.data).toHaveLength(2);
          for (const entry of stored.data) {
            const failed = dataset === failedDataset && entry.name === "anz";
            if (failed) {
              expect(entry).toEqual(
                required(baseline.data.find((item) => item.id === entry.id))
              );
            }
            const rates =
              "plans" in entry
                ? entry.plans.map((plan) => plan.purchaseRate)
                : entry.products.flatMap((product) =>
                    product.rates.map((rate) => rate.rate)
                  );
            expect(rates).toEqual([failed ? 5 : 7]);
          }
          expect(
            db
              .query(
                "SELECT last_checked = last_updated AS fully_checked FROM latest_data WHERE data_type = ?"
              )
              .get(dataset)
          ).toEqual({ fully_checked: dataset === failedDataset ? 0 : 1 });
          if (dataset === failedDataset) {
            expect(
              db
                .query(
                  "SELECT last_checked FROM latest_data WHERE data_type = ?"
                )
                .get(dataset)
            ).toEqual({ last_checked: "2026-10-20 08:00:00" });
          }
          expect(
            db
              .query(
                "SELECT data FROM historical_data WHERE data_type = ? AND date = ?"
              )
              .get(dataset, "2026-10-20")
          ).toEqual({ data: toSavableJson(baseline) });
          expect(
            db
              .query(
                "SELECT data FROM historical_data WHERE data_type = ? AND date = ?"
              )
              .get(dataset, "2026-10-21")
          ).toEqual({ data: toSavableJson(stored) });
        })
      );
    }
  );

  test.each([true, false])(
    "retains failed data, historical dates and freshness with last_checked column=%s",
    async (hasLastChecked) => {
      using db = new Database(":memory:");
      db.exec(`CREATE TABLE latest_data (data_type TEXT PRIMARY KEY, data TEXT NOT NULL, last_updated TEXT${hasLastChecked ? ", last_checked TEXT" : ""});
      CREATE TABLE historical_data (data_type TEXT, date TEXT, data TEXT, UNIQUE(data_type, date));`);
      const previous = await previousModel();
      const encoded = toSavableJson(previous);
      db.query("INSERT INTO historical_data VALUES (?, ?, ?)").run(
        "mortgage-rates",
        "2026-10-04",
        encoded
      );
      db.query(
        `INSERT INTO latest_data VALUES (?, ?, ?${hasLastChecked ? ", ?" : ""})`
      ).run(
        "mortgage-rates",
        encoded,
        "2026-10-04 08:00:00",
        ...(hasLastChecked ? ["2026-10-04 09:00:00"] : [])
      );
      const io: D1SaveDeps = {
        target: { databaseName: "memory-only", flags: ["--local"] },
        now: () => new Date("2026-10-05T08:00:00.000Z"),
        run: (_target, sql) => {
          if (sql.startsWith("SELECT")) {
            return JSON.stringify([
              { success: true, results: db.query(sql).all() },
            ]);
          }
          db.exec(sql);
          return "ok";
        },
      };
      const result = await collect(
        [adapter("anz", 5.5), adapter("midlands", 7)],
        "midlands.example"
      );
      await expect(
        publishDirectDataset({
          collect: async () => result,
          load: () =>
            loadFromD1("mortgage-rates", MortgageRates, {
              ...io,
              strict: true,
            }),
          save: (model, options) =>
            saveToD1(model, "mortgage-rates", { ...io, ...options }),
          markChecked: () => markCheckedInD1("mortgage-rates", io),
          registry,
        })
      ).rejects.toThrow("partial publication saved");
      const stored = await loadFromD1("mortgage-rates", MortgageRates, {
        ...io,
        strict: true,
      });
      expect(stored?.data[0]?.products[0]?.rates[0]?.rate).toBe(5.5);
      expect(stored?.data[1]).toEqual(previous.data[1]);
      expect(stored?.lastUpdated).toBe("2026-10-04T08:00:00.000Z");
      expect(
        db
          .query("SELECT data FROM historical_data WHERE date='2026-10-04'")
          .get()
      ).toEqual({ data: encoded });
      expect(
        db.query("SELECT date FROM historical_data ORDER BY date").all()
      ).toEqual([{ date: "2026-10-04" }, { date: "2026-10-05" }]);
      expect(
        db
          .query("SELECT data FROM historical_data WHERE date='2026-10-05'")
          .get()
      ).toEqual({ data: toSavableJson(stored) });
      const secondResult = await collect(
        [adapter("anz", 5.75), adapter("midlands", 7)],
        "midlands.example"
      );
      await expect(
        publishDirectDataset({
          collect: async () => secondResult,
          load: () =>
            loadFromD1("mortgage-rates", MortgageRates, {
              ...io,
              strict: true,
            }),
          save: (model, options) =>
            saveToD1(model, "mortgage-rates", { ...io, ...options }),
          markChecked: () => markCheckedInD1("mortgage-rates", io),
          registry,
        })
      ).rejects.toThrow("partial publication saved");
      const secondStored = await loadFromD1("mortgage-rates", MortgageRates, {
        ...io,
        strict: true,
      });
      expect(secondStored?.data[0]?.products[0]?.rates[0]?.rate).toBe(5.75);
      expect(secondStored?.data[1]).toEqual(previous.data[1]);
      expect(
        db
          .query("SELECT data FROM historical_data WHERE date='2026-10-05'")
          .get()
      ).toEqual({ data: toSavableJson(secondStored) });
      expect(
        db.query("SELECT COUNT(*) AS count FROM historical_data").get()
      ).toEqual({ count: 2 });
      expect(
        db
          .query("SELECT data FROM historical_data WHERE date='2026-10-04'")
          .get()
      ).toEqual({ data: encoded });
      if (hasLastChecked) {
        expect(db.query("SELECT last_checked FROM latest_data").get()).toEqual({
          last_checked: "2026-10-04 09:00:00",
        });
      }
    }
  );

  test("a first partial save leaves last_checked null", async () => {
    using db = new Database(":memory:");
    db.exec(
      "CREATE TABLE latest_data (data_type TEXT PRIMARY KEY, data TEXT, last_updated TEXT, last_checked TEXT); CREATE TABLE historical_data (data_type TEXT, date TEXT, data TEXT, UNIQUE(data_type,date))"
    );
    expect(
      await saveToD1(await previousModel(), "mortgage-rates", {
        complete: false,
        target: { databaseName: "memory-only", flags: ["--local"] },
        run: (_target, sql) => {
          db.exec(sql);
          return "ok";
        },
      })
    ).toBe(true);
    expect(db.query("SELECT last_checked FROM latest_data").get()).toEqual({
      last_checked: null,
    });
  });
});

describe("fresh source recovery", () => {
  test("recovers only failed sources after peers finish and publishes a complete snapshot", async () => {
    const events: string[] = [];
    const source = adapter("anz", 5.5);
    const { parse } = source;
    source.parse = (pages) => {
      if (pages.get(required(source.urls[0])) !== "rates") {
        throw new Error("Missing disclosed rate");
      }
      return parse(pages);
    };
    const result = await collectDirectDataset(
      "mortgage-rates",
      registry,
      [source, adapter("midlands", 7)],
      async (url) => {
        events.push(`primary:${url}`);
        return "challenge";
      },
      new Date("2026-10-08T08:00:00Z"),
      {
        retryFetchPage: async (url) => {
          events.push(`recovery:${url}`);
          return "rates";
        },
      }
    );
    expect(events).toEqual([
      "primary:https://anz.example/rates",
      "primary:https://midlands.example/rates",
      "recovery:https://anz.example/rates",
    ]);
    expect(result.blockers).toEqual([]);
    expect(result.sources[0]).toMatchObject({
      status: "ok",
      attempts: 2,
      initialError: "Missing disclosed rate",
    });
    const { state, deps } = persistence(result, await previousModel());
    await publishDirectDataset(deps);
    expect(state.complete).toBe(true);
    expect(state.stored?.data).toHaveLength(2);
  });

  test("invalid recovery remains quarantined and retains history and freshness", async () => {
    const previous = await previousModel();
    const result = await collectDirectDataset(
      "mortgage-rates",
      registry,
      [adapter("anz", 150), adapter("midlands", 7)],
      async () => "rates",
      new Date("2026-10-08T08:00:00Z"),
      { retryFetchPage: async () => "rates" }
    );
    expect(result.model).toBeNull();
    expect(result.sources[0]).toMatchObject({
      status: "failed",
      attempts: 2,
      observations: 0,
    });
    const { state, deps } = persistence(result, previous);
    await expect(publishDirectDataset(deps)).rejects.toThrow(
      "partial publication"
    );
    expect(
      state.stored?.data.find((item) => item.id === "institution:anz")
    ).toEqual(previous.data.find((item) => item.id === "institution:anz"));
    expect(state.complete).toBe(false);
    expect(state.checks).toBe(0);
    expect(state.stored?.lastUpdated).toBe(previous.lastUpdated);
  });

  test("recovery refetches every page and never combines attempts", async () => {
    const source = adapter("anz");
    source.urls.push("https://anz.example/terms");
    source.parse = (pages) => {
      expect([...pages.values()]).toEqual(["fresh", "fresh"]);
      return [
        {
          product: "Standard",
          rate: 5,
          termInMonths: 12,
          sourceUrl: required(source.urls[0]),
        },
      ];
    };
    const recovered: string[] = [];
    const result = await collectDirectDataset(
      "mortgage-rates",
      registry,
      [source, adapter("midlands")],
      async (url) => {
        if (url.endsWith("terms")) {
          throw new Error("Timeout");
        }
        return "old";
      },
      undefined,
      {
        retryFetchPage: async (url) => {
          recovered.push(url);
          return "fresh";
        },
      }
    );
    expect(recovered).toEqual(source.urls);
    expect(result.blockers).toEqual([]);
    expect(result.sources[0]?.observations).toBe(1);
  });
});
