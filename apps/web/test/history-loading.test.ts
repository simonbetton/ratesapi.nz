import { afterEach, expect, spyOn, test } from "bun:test";

import { forgetCategory, loadHistory } from "../src/lib/rates-data";

const dates = ["2026-10-09", "2026-11-10"];
function snapshot(rate: number) {
  return {
    type: "MortgageRates",
    // Partial publications deliberately retain this complete-collection date.
    lastUpdated: "2026-10-09T08:00:00Z",
    data: [
      {
        id: "institution:anz",
        name: "ANZ",
        products: [
          {
            id: "product:anz:standard",
            name: "Standard",
            rates: [
              {
                id: "rate:anz:standard:1-year",
                term: "1 year",
                termInMonths: 12,
                rate,
              },
            ],
          },
        ],
      },
    ],
  };
}

const network: {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
} = globalThis;
let fetchSpy: ReturnType<typeof spyOn<typeof network, "fetch">> | undefined;
afterEach(() => {
  fetchSpy?.mockRestore();
  forgetCategory("mortgage");
});

function respond(url: string | URL | Request) {
  const date = new URL(String(url)).searchParams.get("date");
  return Response.json({
    availableDates: dates,
    timeSeries:
      date && dates.includes(date)
        ? { [date]: snapshot(date === "2026-11-10" ? 6 : 5) }
        : {},
  });
}

test("history discovers the newest persisted day instead of treating lastUpdated as a snapshot key", async () => {
  fetchSpy = spyOn(network, "fetch").mockImplementation(async (url) =>
    respond(url)
  );
  const result = await loadHistory("mortgage", "2026-10-09");
  expect(result.status).toBe("success");
  if (result.status !== "success") {
    throw new Error(result.message);
  }
  expect(result.value.at(-1)?.date).toBe("2026-11-10");
  expect(result.value.at(-1)?.rows[0]?.rate).toBe(6);
});

test("a failed monthly request cannot turn into a successful chart with silently missing points", async () => {
  fetchSpy = spyOn(network, "fetch").mockImplementation(async (url) =>
    new URL(String(url)).searchParams.get("date") === "2026-10-09"
      ? new Response("Temporary failure", { status: 503 })
      : respond(url)
  );
  const result = await loadHistory("mortgage", "2026-11-10");
  expect(result.status).toBe("error");
});

test("an explicit history retry recovers without reloading the category or page", async () => {
  fetchSpy = spyOn(network, "fetch").mockResolvedValue(
    new Response("Offline", { status: 503 })
  );
  const initial = loadHistory("mortgage", "2026-11-10");
  const failed = await initial;
  expect(failed.status).toBe("error");
  expect(loadHistory("mortgage", "2026-11-10")).toBe(initial);
  fetchSpy.mockImplementation(async (url) => respond(url));
  const retry = loadHistory("mortgage", "2026-11-10", 1);
  const recovered = await retry;
  expect(recovered.status).toBe("success");
  expect(loadHistory("mortgage", "2026-11-10", 1)).toBe(retry);
});
