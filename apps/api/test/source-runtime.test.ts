import { afterAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const workflow = Bun.YAML.parse(
  readFileSync(
    new URL("../../../.github/workflows/scrape.yml", import.meta.url),
    "utf-8"
  )
) as { jobs: { collect: { steps: { id?: string; run?: string }[] } } };
const command =
  workflow.jobs.collect.steps.find((step) => step.id === "publish")?.run ?? "";
const runtime =
  /^node (?<args>.*?) "?bin\//u.exec(command)?.groups?.args?.split(" ") ?? [];
const server = Bun.serve({
  port: 0,
  fetch(request) {
    return new Response("disclosed rates", {
      headers: {
        "X-Fixture": "a".repeat(
          new URL(request.url).pathname === "/too-large" ? 96 * 1024 : 24 * 1024
        ),
      },
    });
  },
});
afterAll(() => server.stop(true));

test.each([
  ["/rates", 0],
  ["/too-large", 23],
] as const)(
  "production Node runtime handles %s with a bounded header allowance",
  async (route, expected) => {
    const child = Bun.spawn(
      [
        "node",
        ...runtime,
        "--eval",
        'fetch(process.env.HEADER_TEST_URL).then(async r => { if (await r.text() !== "disclosed rates") process.exit(24); }).catch(e => { console.error(e.cause?.code); process.exit(23); });',
      ],
      {
        cwd: new URL("../", import.meta.url).pathname,
        env: {
          ...process.env,
          HEADER_TEST_URL: new URL(route, server.url).href,
        },
        stdout: "pipe",
        stderr: "pipe",
      }
    );
    const status = await child.exited;
    const error = await new Response(child.stderr).text();
    expect({ status, error }).toEqual({
      status: expected,
      error: expected === 23 ? "UND_ERR_HEADERS_OVERFLOW\n" : "",
    });
  }
);
