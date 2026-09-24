import { describe, expect, test } from "bun:test";

import { runScrape } from "../apps/api/bin/scrape-runner";

type FakeData = { data: string[] };

function callCounter() {
  let count = 0;
  return {
    increment: () => {
      count += 1;
    },
    get count() {
      return count;
    },
  };
}

describe("runScrape", () => {
  test("saves once and returns 'saved' when the data has changed", async () => {
    const save = callCounter();
    const outcome = await runScrape<FakeData>({
      loadCurrent: async () => ({ data: ["old"] }),
      fetchHtml: async () => "<html></html>",
      parseAndValidate: async () => ({ data: ["new"] }),
      hasChanged: (newData, oldData) =>
        JSON.stringify(newData) !== JSON.stringify(oldData),
      save: async () => {
        save.increment();
        return true;
      },
    });

    expect(outcome).toEqual({ status: "saved" });
    expect(save.count).toBe(1);
  });

  test("returns 'unchanged' and does not save when the data is identical", async () => {
    const save = callCounter();
    const outcome = await runScrape<FakeData>({
      loadCurrent: async () => ({ data: ["same"] }),
      fetchHtml: async () => "<html></html>",
      parseAndValidate: async () => ({ data: ["same"] }),
      hasChanged: (newData, oldData) =>
        JSON.stringify(newData) !== JSON.stringify(oldData),
      save: async () => {
        save.increment();
        return true;
      },
    });

    expect(outcome).toEqual({ status: "unchanged" });
    expect(save.count).toBe(0);
  });

  test("propagates a fetch rejection", async () => {
    const save = callCounter();
    const fetchError = new Error("fetch failed");

    await expect(
      runScrape<FakeData>({
        loadCurrent: async () => null,
        fetchHtml: async () => {
          throw fetchError;
        },
        parseAndValidate: async () => ({ data: ["new"] }),
        hasChanged: () => true,
        save: async () => {
          save.increment();
          return true;
        },
      })
    ).rejects.toThrow(fetchError);
    expect(save.count).toBe(0);
  });

  test("propagates a parser/guard rejection", async () => {
    const save = callCounter();
    const guardError = new Error("no usable rates");

    await expect(
      runScrape<FakeData>({
        loadCurrent: async () => null,
        fetchHtml: async () => "<html></html>",
        parseAndValidate: async () => {
          throw guardError;
        },
        hasChanged: () => true,
        save: async () => {
          save.increment();
          return true;
        },
      })
    ).rejects.toThrow(guardError);
    expect(save.count).toBe(0);
  });

  test("throws when save resolves false", async () => {
    const save = callCounter();

    await expect(
      runScrape<FakeData>({
        loadCurrent: async () => null,
        fetchHtml: async () => "<html></html>",
        parseAndValidate: async () => ({ data: ["new"] }),
        hasChanged: () => true,
        save: async () => {
          save.increment();
          return false;
        },
      })
    ).rejects.toThrow();
    expect(save.count).toBe(1);
  });

  test("propagates a save rejection", async () => {
    const save = callCounter();
    const saveError = new Error("D1 write failed");

    await expect(
      runScrape<FakeData>({
        loadCurrent: async () => null,
        fetchHtml: async () => "<html></html>",
        parseAndValidate: async () => ({ data: ["new"] }),
        hasChanged: () => true,
        save: async () => {
          save.increment();
          throw saveError;
        },
      })
    ).rejects.toThrow(saveError);
    expect(save.count).toBe(1);
  });

  test("still saves once and returns 'saved' when loadCurrent rejects", async () => {
    const save = callCounter();
    const hasChangedCalls = callCounter();

    const outcome = await runScrape<FakeData>({
      loadCurrent: async () => {
        throw new Error("D1 load failed");
      },
      fetchHtml: async () => "<html></html>",
      parseAndValidate: async () => ({ data: ["new"] }),
      hasChanged: () => {
        hasChangedCalls.increment();
        return true;
      },
      save: async () => {
        save.increment();
        return true;
      },
    });

    expect(outcome).toEqual({ status: "saved" });
    expect(save.count).toBe(1);
    // hasChanged must not be consulted when current data is null.
    expect(hasChangedCalls.count).toBe(0);
  });
});
