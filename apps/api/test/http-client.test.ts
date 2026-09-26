import { afterAll, describe, expect, test } from "bun:test";

import { createHttpClient } from "../src/lib/http-client";

// A local server: /hang answers after 5 seconds (much later than the time
// limits in these tests), /flaky does the same for the first request only,
// and /ok answers at once.
let flakyRequests = 0;
const server = Bun.serve({
  port: 0,
  async fetch(request) {
    const { pathname } = new URL(request.url);

    if (pathname === "/ok") {
      return new Response("ok");
    }

    if (pathname === "/flaky") {
      flakyRequests += 1;
      if (flakyRequests > 1) {
        return new Response("ok");
      }
    }

    await Bun.sleep(5000);
    return new Response("late");
  },
});

afterAll(() => {
  server.stop(true);
});

describe("createHttpClient timeoutMs", () => {
  test("fails a request that hangs", async () => {
    const client = createHttpClient("TimeoutTest", {
      prefixUrl: server.url.toString(),
      timeoutMs: 100,
    });

    await expect(client("hang")).rejects.toThrow();
  });

  test("gives each retry its own time limit", async () => {
    const client = createHttpClient("TimeoutTest", {
      prefixUrl: server.url.toString(),
      timeoutMs: 100,
      retryOptions: { retries: 1, retryDelay: 0, retryOn: [] },
    });

    const response = await client("flaky");

    expect(response.status).toBe(200);
    expect(flakyRequests).toBe(2);
  });

  test("does not change a request that answers in time", async () => {
    const client = createHttpClient("TimeoutTest", {
      prefixUrl: server.url.toString(),
      timeoutMs: 1000,
    });

    const response = await client("ok");

    expect(await response.text()).toBe("ok");
  });
});
