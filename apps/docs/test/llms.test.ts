import { describe, expect, test } from "bun:test";

import { renderLlmsFull, renderLlmsIndex, toAbsoluteLinks } from "../lib/llms";
import type { LlmsPage } from "../lib/llms";

const overview: LlmsPage = {
  url: "/",
  slugs: [],
  data: { title: "Overview", description: "The overview." },
};
const quickstart: LlmsPage = {
  url: "/api-reference/quickstart",
  slugs: ["api-reference", "quickstart"],
  data: { title: "Quickstart", description: "Send your first request." },
};
const deployment: LlmsPage = {
  url: "/open-source/deployment",
  slugs: ["open-source", "deployment"],
  data: { title: "Deployment", description: "Deploy your own copy." },
};
const about: LlmsPage = {
  url: "/about",
  slugs: ["about"],
  data: { title: "About", description: "The data source and terms." },
};

describe("renderLlmsIndex", () => {
  const index = renderLlmsIndex([overview, quickstart, deployment, about]);

  test("uses the llmstxt.org structure", () => {
    expect(index.startsWith("# Rates API\n\n> ")).toBe(true);
    expect(index).toContain("\n\n## Docs\n\n");
    expect(index).toContain("\n\n## API\n\n");
    expect(index).toContain("\n\n## Optional\n\n");
  });

  test("lists the API pages under Docs with absolute URLs", () => {
    const docs = section(index, "Docs");

    expect(docs).toContain(
      "- [Overview](https://www.ratesapi.nz/docs): The overview."
    );
    expect(docs).toContain(
      "- [Quickstart](https://www.ratesapi.nz/docs/api-reference/quickstart): Send your first request."
    );
    expect(docs).not.toContain("Deployment");
  });

  test("lists the machine-readable API items", () => {
    const api = section(index, "API");

    expect(api).toContain("(https://www.ratesapi.nz/openapi/json)");
    expect(api).toContain("(https://www.ratesapi.nz/openapi)");
    expect(api).toContain("(https://www.ratesapi.nz/api/v1/mcp)");
    expect(api).toContain("(https://www.ratesapi.nz/api/v1/mortgage-rates)");
    expect(api).toContain("(https://www.ratesapi.nz/api/v1/health)");
  });

  test("lists the open source and about pages as optional", () => {
    const optional = section(index, "Optional");

    expect(optional).toContain(
      "(https://www.ratesapi.nz/docs/open-source/deployment)"
    );
    expect(optional).toContain("(https://www.ratesapi.nz/docs/about)");
    expect(optional).toContain("(https://www.ratesapi.nz/docs/llms-full.txt)");
  });
});

describe("renderLlmsFull", () => {
  test("gives each page with its URL and absolute links", () => {
    const full = renderLlmsFull([
      {
        page: quickstart,
        markdown: "Read [Core Concepts](/api-reference/concepts).",
      },
    ]);

    expect(full).toContain(
      "# Quickstart\n\nURL: https://www.ratesapi.nz/docs/api-reference/quickstart"
    );
    expect(full).toContain(
      "[Core Concepts](https://www.ratesapi.nz/docs/api-reference/concepts)"
    );
  });
});

describe("toAbsoluteLinks", () => {
  test("adds /docs to docs links but not to API Worker links", () => {
    expect(
      toAbsoluteLinks(
        "[Quickstart](/api-reference/quickstart) [OpenAPI](/openapi/json) [MCP](/api/v1/mcp) [llms.txt](/llms.txt)"
      )
    ).toBe(
      "[Quickstart](https://www.ratesapi.nz/docs/api-reference/quickstart) [OpenAPI](https://www.ratesapi.nz/openapi/json) [MCP](https://www.ratesapi.nz/api/v1/mcp) [llms.txt](https://www.ratesapi.nz/docs/llms.txt)"
    );
  });

  test("keeps absolute links and anchors", () => {
    const markdown = "[Site](https://www.interest.co.nz) [Top](#top)";

    expect(toAbsoluteLinks(markdown)).toBe(markdown);
  });
});

function section(markdown: string, heading: string): string {
  return markdown.split(`## ${heading}\n\n`)[1]?.split("\n\n## ")[0] ?? "";
}
