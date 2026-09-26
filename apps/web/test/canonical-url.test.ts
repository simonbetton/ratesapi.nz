import { describe, expect, test } from "bun:test";

import { canonicalRedirect } from "../src/lib/canonical-url";

describe("canonical redirects", () => {
  test("serves www requests", () => {
    expect(canonicalRedirect("https://www.ratesapi.nz/")).toBeNull();
    expect(
      canonicalRedirect("https://www.ratesapi.nz/images/hero.webp")
    ).toBeNull();
  });

  test("sends the apex to www, keeping the path and query", () => {
    expect(canonicalRedirect("https://ratesapi.nz/")).toBe(
      "https://www.ratesapi.nz/"
    );
    expect(canonicalRedirect("http://ratesapi.nz/docs?q=mcp")).toBe(
      "https://www.ratesapi.nz/docs?q=mcp"
    );
  });

  test("moves the old apex docs pages under /docs", () => {
    expect(
      canonicalRedirect("https://ratesapi.nz/api-reference/quickstart")
    ).toBe("https://www.ratesapi.nz/docs/api-reference/quickstart");
    expect(canonicalRedirect("https://ratesapi.nz/open-source")).toBe(
      "https://www.ratesapi.nz/docs/open-source"
    );
    expect(canonicalRedirect("https://www.ratesapi.nz/llms.txt")).toBe(
      "https://www.ratesapi.nz/docs/llms.txt"
    );
    expect(canonicalRedirect("https://www.ratesapi.nz/llms-full.txt")).toBe(
      "https://www.ratesapi.nz/docs/llms-full.txt"
    );
  });

  test("sends the old introduction straight to the API reference", () => {
    expect(
      canonicalRedirect("http://ratesapi.nz/api-reference/introduction")
    ).toBe("https://www.ratesapi.nz/docs/api-reference");
    expect(
      canonicalRedirect("https://www.ratesapi.nz/api-reference/introduction/")
    ).toBe("https://www.ratesapi.nz/docs/api-reference");
  });

  test("moves every docs.ratesapi.nz page in one hop, keeping the query", () => {
    expect(canonicalRedirect("https://docs.ratesapi.nz/")).toBe(
      "https://www.ratesapi.nz/docs"
    );
    expect(canonicalRedirect("http://docs.ratesapi.nz/?utm_source=x")).toBe(
      "https://www.ratesapi.nz/docs?utm_source=x"
    );
    expect(
      canonicalRedirect("https://docs.ratesapi.nz/api-reference/quickstart?a=1")
    ).toBe("https://www.ratesapi.nz/docs/api-reference/quickstart?a=1");
    expect(
      canonicalRedirect("https://docs.ratesapi.nz/api-reference/introduction")
    ).toBe("https://www.ratesapi.nz/docs/api-reference");
    expect(canonicalRedirect("https://docs.ratesapi.nz/llms-full.txt")).toBe(
      "https://www.ratesapi.nz/docs/llms-full.txt"
    );
  });

  test("sends the old endpoint pages to the OpenAPI reference", () => {
    expect(
      canonicalRedirect(
        "https://docs.ratesapi.nz/api-reference/endpoint/mortgage-rates/list"
      )
    ).toBe("https://www.ratesapi.nz/openapi");
    expect(
      canonicalRedirect("https://docs.ratesapi.nz/api-reference/endpoint")
    ).toBe("https://www.ratesapi.nz/openapi");
  });

  test("leaves look-alike paths alone", () => {
    expect(
      canonicalRedirect("https://www.ratesapi.nz/open-sourcery")
    ).toBeNull();
    expect(
      canonicalRedirect("https://www.ratesapi.nz/llms.txt.bak")
    ).toBeNull();
    expect(
      canonicalRedirect("https://docs.ratesapi.nz/api-reference/endpoints")
    ).toBe("https://www.ratesapi.nz/docs/api-reference/endpoints");
  });
});
