import { describe, expect, test } from "bun:test";

const docsRoot = new URL("../apps/docs/content/docs/", import.meta.url);
const docsAppRoot = new URL("../apps/docs/", import.meta.url);

describe("docs MDX content", () => {
  test("keeps the root documentation page as the Introduction page", async () => {
    const body = await readDocsFile("index.mdx");

    expect(body).toContain('title: "Introduction"');
    expect(body).toContain(
      "Rates API is a comprehensive and up-to-date service",
    );
    expect(body).toContain("| Mortgage Rates |");
  });

  test("keeps the mortgage time-series endpoint page at the existing URL", async () => {
    const body = await readDocsFile(
      "api-reference/endpoint/mortgage-rates/time-series.mdx",
    );

    expect(body).toContain('title: "Mortgage Rates Time Series"');
    expect(body).toContain("| Path | `/api/v1/mortgage-rates/time-series` |");
    expect(body).toContain(
      "| `termInMonths` | optional mortgage term filter |",
    );
  });

  test("keeps the deployment guide under open-source docs", async () => {
    const body = await readDocsFile("open-source/deployment.mdx");

    expect(body).toContain('title: "Deployment"');
    expect(body).toContain("bun run deploy");
    expect(body).toContain("Cloudflare D1");
  });

  test("keeps docs search and LLM routes owned by the docs app", async () => {
    const searchRoute = await readDocsAppFile("app/api/search/route.ts");
    const llmsRoute = await readDocsAppFile("app/llms.txt/route.ts");

    expect(searchRoute).toContain('import { searchApi } from "@/lib/source";');
    expect(searchRoute).toContain("export const GET = searchApi.GET;");
    expect(llmsRoute).toContain('import { docsLlms } from "@/lib/source";');
    expect(llmsRoute).toContain("docsLlms.index()");
  });
});

function readDocsFile(path: string): Promise<string> {
  return Bun.file(new URL(path, docsRoot)).text();
}

function readDocsAppFile(path: string): Promise<string> {
  return Bun.file(new URL(path, docsAppRoot)).text();
}
