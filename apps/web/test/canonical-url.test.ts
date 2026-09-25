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
  });

  test("leaves look-alike paths alone", () => {
    expect(
      canonicalRedirect("https://www.ratesapi.nz/open-sourcery")
    ).toBeNull();
    expect(
      canonicalRedirect("https://www.ratesapi.nz/llms.txt.bak")
    ).toBeNull();
  });
});
