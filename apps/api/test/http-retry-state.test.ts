import { afterEach, expect, spyOn, test } from "bun:test";

import { createHttpClient } from "../src/lib/http-client";

const network: {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
} = globalThis;
let fetchSpy: ReturnType<typeof spyOn<typeof network, "fetch">> | undefined;
afterEach(() => fetchSpy?.mockRestore());

test("a permanent HTTP failure is terminal even when network retries remain", async () => {
  fetchSpy = spyOn(network, "fetch").mockImplementation(
    async () => new Response("Not found", { status: 404 })
  );
  const client = createHttpClient("RetryState", {
    retryOptions: { retries: 3, retryDelay: 0, retryOn: [503] },
  });
  await expect(client("https://fixture.example/missing")).rejects.toThrow(
    "404"
  );
  expect(fetchSpy).toHaveBeenCalledTimes(1);
});

test("cancellation during retry backoff is terminal and starts no further request", async () => {
  const controller = new AbortController();
  fetchSpy = spyOn(network, "fetch").mockImplementation(async () => {
    setTimeout(() => controller.abort(), 5);
    return new Response("Unavailable", { status: 503 });
  });
  const client = createHttpClient("RetryState", {
    retryOptions: { retries: 3, retryDelay: 50, retryOn: [503] },
  });
  await expect(
    client("https://fixture.example/rates", { signal: controller.signal })
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(fetchSpy).toHaveBeenCalledTimes(1);
});

test("retry releases the failed response body before opening another request", async () => {
  let cancelled = false;
  const response = new Response(
    new ReadableStream({
      cancel() {
        cancelled = true;
      },
    }),
    { status: 503 }
  );
  fetchSpy = spyOn(network, "fetch")
    .mockResolvedValueOnce(response)
    .mockImplementation(async () => {
      expect(cancelled).toBe(true);
      return new Response("ok");
    });
  const client = createHttpClient("RetryState", {
    retryOptions: { retries: 1, retryDelay: 0, retryOn: [503] },
  });
  const success = await client("https://fixture.example/rates");
  expect(await success.text()).toBe("ok");
});
