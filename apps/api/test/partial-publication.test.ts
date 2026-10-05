import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";

import { collectDirectDataset } from "../bin/direct/collect";
import type { CollectionResult } from "../bin/direct/collect";
import type { PublishDependencies } from "../bin/direct/run";
import { publishDirectBatch, publishDirectDataset } from "../bin/direct/run";
import type { DirectSource, Institution } from "../bin/direct/types";
import { loadFromD1, markCheckedInD1, saveToD1 } from "../bin/utils";
import type { D1SaveDeps } from "../bin/utils";
import { toSavableJson } from "../src/lib/data-loader";
import type { SupportedModels } from "../src/lib/data-loader";
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
