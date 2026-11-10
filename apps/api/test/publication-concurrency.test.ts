import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { collectDirectDataset } from "../bin/direct/collect";
import { SourceUnavailableError } from "../bin/direct/failures";
import { persistenceFor, publishDirectDataset } from "../bin/direct/run";
import type { DirectSource, Institution } from "../bin/direct/types";
import { loadFromD1, saveToD1 } from "../bin/utils";
import type { D1SaveDeps } from "../bin/utils";
import { MortgageRates } from "../src/models/mortgage-rates";

const registry: Institution[] = ["anz", "midlands"].map((id) => ({
  id,
  name: id,
  datasets: {
    "mortgage-rates": {
      status: "active",
      reason: "Fixture",
      legacyProducts: [],
    },
  },
}));

async function collection(rate: number, checkedAt: string, failed?: string) {
  const sources: DirectSource[] = registry.map(({ id }) => ({
    id,
    institution: id,
    dataset: "mortgage-rates",
    urls: [`https://${id}.example/rates`],
    parse: () => [
      {
        product: "Standard",
        rate,
        termInMonths: 12,
        sourceUrl: `https://${id}.example/rates`,
      },
    ],
  }));
  return collectDirectDataset(
    "mortgage-rates",
    registry,
    sources,
    async (url) => {
      if (url === `https://${failed}.example/rates`) {
        throw new SourceUnavailableError("Fixture outage");
      }
      return "rates";
    },
    new Date(checkedAt)
  );
}

function database() {
  const db = new Database(":memory:");
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf-8"));
  const io: D1SaveDeps = {
    target: { databaseName: "memory-only", flags: ["--local"] },
    now: () => new Date("2026-11-10T10:00:00Z"),
    run: (_target, sql) =>
      db.transaction(() =>
        JSON.stringify(
          sql
            .split(";")
            .filter((statement) => statement.trim())
            .map((statement) => {
              expect(Buffer.byteLength(statement)).toBeLessThan(100_000);
              return { success: true, results: db.query(statement).all() };
            })
        )
      )(),
  };
  return { db, io };
}

function deferred() {
  return Promise.withResolvers<undefined>();
}

test("an overlapping partial publisher cannot overwrite a peer's verified update", async () => {
  const { db, io } = database();
  try {
    const baseline = await collection(5, "2026-11-09T08:00:00Z");
    if (!baseline.model) {
      throw new Error("Missing fixture");
    }
    await saveToD1(baseline.model, "mortgage-rates", io);
    const first = {
      ...persistenceFor(
        await collection(6, "2026-11-10T08:00:00Z", "midlands"),
        io
      ),
      registry,
    };
    const second = {
      ...persistenceFor(await collection(7, "2026-11-10T09:00:00Z", "anz"), io),
      registry,
    };
    const read = deferred();
    const resume = deferred();
    const { load } = second;
    second.load = async () => {
      const model = await load();
      read.resolve(undefined);
      await resume.promise;
      return model;
    };
    const pending = publishDirectDataset(second);
    await read.promise;
    await publishDirectDataset(first);
    resume.resolve(undefined);
    await expect(pending).rejects.toThrow(/concurrent|newer/u);
    const stored = await loadFromD1("mortgage-rates", MortgageRates, {
      ...io,
      strict: true,
    });
    expect(
      stored?.data.map((entry) => entry.products[0]?.rates[0]?.rate)
    ).toEqual([6, 5]);
    await publishDirectDataset({
      ...persistenceFor(await collection(7, "2026-11-10T10:00:00Z", "anz"), io),
      registry,
    });
    const retried = await loadFromD1("mortgage-rates", MortgageRates, {
      ...io,
      strict: true,
    });
    expect(
      retried?.data.map((entry) => entry.products[0]?.rates[0]?.rate)
    ).toEqual([6, 7]);
  } finally {
    db.close();
  }
});

function persisted(db: Database) {
  return {
    latest: db.query("SELECT * FROM latest_data").all(),
    history: db.query("SELECT * FROM historical_data").all(),
    publication: db.query("SELECT * FROM publication_state").all(),
  };
}

test("a legacy database can save changed data without claiming complete-check freshness", async () => {
  const { db, io } = database();
  try {
    db.exec("ALTER TABLE latest_data DROP COLUMN last_checked");
    await expect(
      publishDirectDataset({
        ...persistenceFor(await collection(6, "2026-11-10T09:00:00Z"), io),
        registry,
      })
    ).resolves.toBe("saved");
    const stored = await loadFromD1("mortgage-rates", MortgageRates, {
      ...io,
      strict: true,
    });
    expect(stored?.data[0]?.products[0]?.rates[0]?.rate).toBe(6);
  } finally {
    db.close();
  }
});

test("a slow older collection cannot replace a newer publication even after reading it", async () => {
  const { db, io } = database();
  try {
    await publishDirectDataset({
      ...persistenceFor(await collection(6, "2026-11-10T09:00:00Z"), io),
      registry,
    });
    const before = persisted(db);
    await expect(
      publishDirectDataset({
        ...persistenceFor(await collection(5, "2026-11-10T08:00:00Z"), io),
        registry,
      })
    ).rejects.toThrow(/newer/u);
    expect(persisted(db)).toEqual(before);
  } finally {
    db.close();
  }
});

test("an unchanged complete check cannot mark a concurrent partial update fresh", async () => {
  const { db, io } = database();
  try {
    await publishDirectDataset({
      ...persistenceFor(await collection(5, "2026-11-10T07:00:00Z"), io),
      registry,
    });
    const checking = {
      ...persistenceFor(await collection(5, "2026-11-10T08:00:00Z"), io),
      registry,
    };
    const read = deferred();
    const resume = deferred();
    const { load } = checking;
    checking.load = async () => {
      const model = await load();
      read.resolve(undefined);
      await resume.promise;
      return model;
    };
    const pending = publishDirectDataset(checking);
    await read.promise;
    await publishDirectDataset({
      ...persistenceFor(
        await collection(6, "2026-11-10T09:00:00Z", "midlands"),
        io
      ),
      registry,
    });
    const before = persisted(db);
    resume.resolve(undefined);
    await expect(pending).rejects.toThrow(/concurrent|newer/u);
    expect(persisted(db)).toEqual(before);
  } finally {
    db.close();
  }
});

test("replaying a collection after a lost acknowledgement cannot write again", async () => {
  const { db, io } = database();
  try {
    const result = await collection(6, "2026-11-10T09:00:00Z");
    const { run } = io;
    if (!run) {
      throw new Error("Missing test runner");
    }
    const lostResponse = {
      ...io,
      run: (...args: Parameters<typeof run>) => {
        const response = run(...args);
        if (args[1].startsWith("INSERT INTO publication_state")) {
          throw new Error("Lost acknowledgement");
        }
        return response;
      },
    };
    await expect(
      publishDirectDataset({
        ...persistenceFor(result, lostResponse),
        registry,
      })
    ).rejects.toThrow("Lost acknowledgement");
    const before = persisted(db);
    await expect(
      publishDirectDataset({ ...persistenceFor(result, io), registry })
    ).rejects.toThrow(/newer/u);
    expect(persisted(db)).toEqual(before);
  } finally {
    db.close();
  }
});

test("failed large publication rolls back its revision and history so a retry can succeed", async () => {
  const { db, io } = database();
  try {
    await publishDirectDataset({
      ...persistenceFor(await collection(5, "2026-11-10T07:00:00Z"), io),
      registry,
    });
    const before = persisted(db);
    const result = await collection(6, "2026-11-10T09:00:00Z");
    const institution = result.publishable?.data[0];
    if (!institution) {
      throw new Error("Missing test fixture");
    }
    institution.name = "Kāinga 🏠".repeat(20_000);
    db.exec(
      "CREATE TRIGGER fail_publication BEFORE INSERT ON latest_data BEGIN SELECT RAISE(ABORT, 'forced failure'); END"
    );
    await expect(
      publishDirectDataset({ ...persistenceFor(result, io), registry })
    ).rejects.toThrow("forced failure");
    expect(persisted(db)).toEqual(before);
    db.exec("DROP TRIGGER fail_publication");
    await expect(
      publishDirectDataset({ ...persistenceFor(result, io), registry })
    ).resolves.toBe("saved");
    const stored = await loadFromD1("mortgage-rates", MortgageRates, {
      ...io,
      strict: true,
    });
    expect(stored?.data[0]?.name).toBe(institution.name);
  } finally {
    db.close();
  }
});
