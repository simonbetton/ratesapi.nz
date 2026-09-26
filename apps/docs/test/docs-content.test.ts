import { describe, expect, test } from "bun:test";

const docsRoot = new URL("../content/docs/", import.meta.url);
const docsAppRoot = new URL("../", import.meta.url);

describe("docs MDX content", () => {
  test("keeps the root documentation page as a concise overview", async () => {
    const body = await readDocsFile("index.mdx");

    expect(body).toContain('title: "Overview"');
    expect(body).toContain("free JSON API");
    expect(body).toContain("## Key Facts");
    // The docs link back to the landing page.
    expect(body).toContain("[Rates API](https://www.ratesapi.nz/)");
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
    // Without the trailing *, the route does not match /docs?query.
    expect(deployment).toContain('pattern = "www.ratesapi.nz/docs*"');
    // The development environment reuses the production D1 database ID.
    expect(localDevelopment).toContain("same database ID as production");
    // CodeQL runs through GitHub's default setup, not a workflow file.
    expect(monitoring).toContain("CodeQL analysis through its default setup");
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
      "curl https://www.ratesapi.nz/api/v1/mortgage-rates"
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
    expect(nextConfig).toContain('const basePath = "/docs";');
    expect(nextConfig).toContain("/api-reference/endpoint/:path*`");
    expect(nextConfig).toContain("destination: openApiReferenceUrl");
    // The OpenAPI reference is outside the docs basePath.
    expect(nextConfig).toContain("basePath: false");
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
    const llmsFullRoute = await readDocsAppFile("app/llms-full.txt/route.ts");

    expect(searchRoute).toContain('import { searchApi } from "@/lib/source";');
    expect(searchRoute).toContain("export const { GET } = searchApi;");
    // Both LLM files list the sidebar pages and are made at build time.
    expect(llmsRoute).toContain("renderLlmsIndex(getNavPages())");
    expect(llmsRoute).toContain('export const dynamic = "force-static";');
    expect(llmsFullRoute).toContain('page.data.getText("processed")');
    expect(llmsFullRoute).toContain('export const dynamic = "force-static";');
  });

  test("serves the prerendered docs pages without a render per request", async () => {
    const openNextConfig = await readDocsAppFile("open-next.config.ts");
    const wrangler = await readDocsAppFile("wrangler.toml");

    expect(openNextConfig).toContain(
      "incrementalCache: staticAssetsIncrementalCache"
    );
    expect(openNextConfig).toContain("enableCacheInterception: true");
    // One route for /docs, /docs?query, and /docs/*.
    expect(wrangler).toContain('pattern = "www.ratesapi.nz/docs*"');
    expect(wrangler).not.toContain('pattern = "www.ratesapi.nz/docs"');
    expect(wrangler).toContain("[observability.logs]");
  });

  test("redirects the old introduction page to the API reference", async () => {
    const introductionPage = Bun.file(
      new URL("api-reference/introduction.mdx", docsRoot)
    );
    const nextConfig = await readDocsAppFile("next.config.mjs");

    expect(await introductionPage.exists()).toBe(false);
    expect(nextConfig).toContain("/api-reference/introduction`,");
    expect(nextConfig).toContain("/api-reference`,");
  });

  test("adds the about page with the data source and terms", async () => {
    const about = await readDocsFile("about.mdx");
    const meta: unknown = JSON.parse(await readDocsFile("meta.json"));

    expect(meta).toEqual({
      title: "Rates API",
      pages: ["index", "api-reference", "open-source", "about"],
    });
    // The landing page links to this anchor.
    expect(about).toContain(
      "## Data Source and Licence [#data-source-and-licence]"
    );
    expect(about).toContain("It does not apply to the rate data.");
    expect(about).toContain("### Is Rates API affiliated with interest.co.nz?");
    expect(about).toContain("### Can I use the data commercially?");
    expect(about).toContain(
      "https://github.com/simonbetton/ratesapi.nz/issues"
    );
  });

  test("gives each page a search description about New Zealand", async () => {
    const paths = await Array.fromAsync(
      new Bun.Glob("**/*.mdx").scan({ cwd: docsRoot.pathname })
    );
    const bodies = await Promise.all(paths.map(readDocsFile));

    expect(paths.length).toBeGreaterThan(0);

    for (const [index, path] of paths.entries()) {
      const description =
        /^description: "(?<description>.+)"$/mu.exec(bodies[index] ?? "")
          ?.groups?.description ?? "";

      expect({ path, description }).toEqual({
        path,
        description: expect.stringContaining("New Zealand"),
      });
      // Search results cut descriptions that are longer.
      expect(description.length).toBeLessThanOrEqual(155);
    }
  });
});

function readDocsFile(path: string): Promise<string> {
  return Bun.file(new URL(path, docsRoot)).text();
}

function readDocsAppFile(path: string): Promise<string> {
  return Bun.file(new URL(path, docsAppRoot)).text();
}
