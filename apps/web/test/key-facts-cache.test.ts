import { expect, test } from "bun:test";

test("concurrent homepage requests cannot replace verified facts with a late failure", () => {
  // Isolate the Workers-only module mock from other tests in the Bun process.
  const child = Bun.spawnSync(
    [
      process.execPath,
      "--eval",
      `
    import { mock } from "bun:test";
    const ready = Promise.withResolvers();
    const lateFailure = Promise.withResolvers();
    let calls = 0;
    const types = { "mortgage-rates": "MortgageRates", "personal-loan-rates": "PersonalLoanRates", "car-loan-rates": "CarLoanRates", "credit-card-rates": "CreditCardRates" };
    mock.module("cloudflare:workers", () => ({ env: { RATES_API: {
      async fetch(url) {
        const request = calls++;
        await (request < 5 ? ready.promise : lateFailure.promise);
        if (request >= 5) return new Response("Unavailable", { status: 503 });
        const type = types[new URL(url).pathname.split("/").at(-1)];
        return Response.json(type ? { type, data: [{}], lastUpdated: "2026-11-10T00:00:00Z" } : { availableDates: ["2026-04-30"] });
      }
    } } }));
    const { loadKeyFacts } = await import("./src/lib/key-facts.server.ts");
    const first = loadKeyFacts();
    const second = loadKeyFacts();
    ready.resolve();
    await first;
    lateFailure.resolve();
    const results = await Promise.all([first, second]);
    const cached = await loadKeyFacts();
    console.log(JSON.stringify({ calls, equal: JSON.stringify(results[0]) === JSON.stringify(results[1]), cached: JSON.stringify(cached) === JSON.stringify(results[0]), lenders: cached?.mortgageLenders }));
  `,
    ],
    {
      cwd: new URL("../", import.meta.url).pathname,
      stdout: "pipe",
      stderr: "pipe",
    }
  );
  expect({ exitCode: child.exitCode, error: child.stderr.toString() }).toEqual({
    exitCode: 0,
    error: "",
  });
  expect(JSON.parse(child.stdout.toString())).toEqual({
    calls: 5,
    equal: true,
    cached: true,
    lenders: 1,
  });
});
