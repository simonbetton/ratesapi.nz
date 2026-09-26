import { afterAll, afterEach, describe, expect, spyOn, test } from "bun:test";

import { requestExample, requestUrl } from "../src/lib/api-examples";
import { fetchMortgageRates } from "../src/lib/rates-request";

const fetchSpy = spyOn(globalThis, "fetch");

afterAll(() => {
  fetchSpy.mockRestore();
});

afterEach(() => {
  fetchSpy.mockReset();
});

describe("landing page live requests", () => {
  test("fetches the selected term and returns formatted live JSON", async () => {
    const payload = {
      type: "MortgageRates",
      data: [],
      lastUpdated: "2026-09-24T00:00:00.000Z",
    };
    fetchSpy.mockResolvedValue(Response.json(payload));

    const result = await fetchMortgageRates("24");

    expect(fetchSpy).toHaveBeenCalledWith(requestUrl("24"), {
      signal: expect.any(AbortSignal),
    });
    expect(result).toEqual({
      status: "success",
      body: JSON.stringify(payload, null, 2),
    });
  });

  test("omits the term filter when all terms are selected", async () => {
    fetchSpy.mockResolvedValue(new Response("{}"));
    await fetchMortgageRates("");
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "https://www.ratesapi.nz/api/v1/mortgage-rates"
    );
  });

  test("reports HTTP failures and allows a successful retry", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("Unavailable", { status: 503 })
    );
    expect(await fetchMortgageRates("12")).toEqual({
      status: "error",
      message: "The API returned HTTP 503. Try again or check service health.",
    });

    fetchSpy.mockResolvedValueOnce(new Response("{}"));
    const retry = await fetchMortgageRates("12");
    expect(retry.status).toBe("success");
  });

  test("handles unavailable networks, timeouts and invalid JSON", async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const offline = await fetchMortgageRates("12");
    expect(offline.status).toBe("error");

    fetchSpy.mockRejectedValueOnce(
      new DOMException("Timed out", "TimeoutError")
    );
    const timeout = await fetchMortgageRates("12");
    expect(timeout.status).toBe("error");

    fetchSpy.mockResolvedValueOnce(new Response("<html>Not JSON</html>"));
    const invalidJson = await fetchMortgageRates("12");
    expect(invalidJson.status).toBe("error");
  });
});

describe("copyable integration examples", () => {
  test("encodes filters before including them in request snippets", () => {
    expect(requestUrl("12&x=1")).toBe(
      "https://www.ratesapi.nz/api/v1/mortgage-rates?termInMonths=12%26x%3D1"
    );
  });

  test("Python example names its app, since urllib's default agent is blocked", () => {
    const source = requestExample("Python", "12");
    expect(source).toContain(`url = '${requestUrl("12")}'`);
    expect(source).toContain("headers = {'User-Agent': ");
    expect(source).toContain("urlopen(Request(url, headers=headers)");
  });

  test("JavaScript example returns the documented data and checks failed responses", async () => {
    const source = requestExample("JavaScript", "24");
    const messages: unknown[][] = [];
    const context = {
      fetch: async (url: string) => {
        expect(url).toBe(requestUrl("24"));
        return Response.json({
          data: [{ name: "ANZ" }],
          lastUpdated: "2026-09-24",
        });
      },
      console: { log: (...values: unknown[]) => messages.push(values) },
    };
    // Execute the exact public snippet with isolated dependencies.
    const { runInNewContext } = await import("node:vm");
    await runInNewContext(`(async () => { ${source} })()`, context);
    expect(messages).toEqual([[[{ name: "ANZ" }], "2026-09-24"]]);

    await expect(
      runInNewContext(`(async () => { ${source} })()`, {
        ...context,
        fetch: async () => new Response("Unavailable", { status: 503 }),
      })
    ).rejects.toThrow("Rates API: 503");
  });
});
