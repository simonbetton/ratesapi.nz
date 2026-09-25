import { describe, expect, test } from "bun:test";

const docsRoot = new URL("../content/docs/", import.meta.url);
const docsAppRoot = new URL("../", import.meta.url);

describe("docs MDX content", () => {
  test("keeps the root documentation page as a concise overview", async () => {
    const body = await readDocsFile("index.mdx");

    expect(body).toContain('title: "Overview"');
    expect(body).toContain("free JSON API");
    expect(body).toContain("## Made for AI Agents");
    expect(body).toContain("| Mortgage Rates |");
  });

  test("keeps operational instructions in line with the repository", async () => {
    const deployment = await readDocsFile("open-source/deployment.mdx");
    const localDevelopment = await readDocsFile(
      "open-source/local-development.mdx"
    );
    const monitoring = await readDocsFile("open-source/monitoring.mdx");

    // Without --remote, Wrangler only changes the local database.
    expect(deployment).toContain(
      "wrangler d1 execute ratesapi-data --remote --file=schema.sql"
    );
    expect(deployment).toContain('pattern = "ratesapi.nz/openapi/*"');
    // The development environment reuses the production D1 database ID.
    expect(localDevelopment).toContain("same database ID as production");
    expect(monitoring).not.toContain("CodeQL");
  });

  test("keeps API navigation free of duplicate introduction links", async () => {
    const meta: unknown = JSON.parse(
      await readDocsFile("api-reference/meta.json")
    );

    expect(meta).toEqual({
      title: "API Reference",
      pages: [
        "index",
        "quickstart",
        "ai-integration",
        "concepts",
        "[OpenAPI Reference](/openapi)",
      ],
    });
  });

  test("adds task-oriented API onboarding pages", async () => {
    const quickstart = await readDocsFile("api-reference/quickstart.mdx");
    const aiIntegration = await readDocsFile(
      "api-reference/ai-integration.mdx"
    );
    const concepts = await readDocsFile("api-reference/concepts.mdx");

    expect(quickstart).toContain('title: "Quickstart"');
    expect(quickstart).toContain(
      "curl https://ratesapi.nz/api/v1/mortgage-rates"
    );
    expect(aiIntegration).toContain('title: "AI Integration"');
    expect(aiIntegration).toContain("POST /api/v1/mcp");
    expect(aiIntegration).toContain("/openapi/json");
    expect(aiIntegration).toContain("/llms.txt");
    expect(concepts).toContain('title: "Core Concepts"');
    expect(concepts).toContain(
      "Use either `date` or the `startDate` and `endDate` pair"
    );
  });

  test("redirects old endpoint pages to the OpenAPI reference", async () => {
    const endpointPage = Bun.file(
      new URL("api-reference/endpoint/mortgage-rates/time-series.mdx", docsRoot)
    );
    const nextConfig = await readDocsAppFile("next.config.mjs");

    expect(await endpointPage.exists()).toBe(false);
    expect(nextConfig).toContain('source: "/api-reference/endpoint/:path*"');
    expect(nextConfig).toContain("destination: openApiReferenceUrl");
    expect(nextConfig).toContain('"http://localhost:8787/openapi"');
    expect(nextConfig).toContain(': "/openapi"');
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
    expect(searchRoute).toContain("export const { GET } = searchApi;");
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
