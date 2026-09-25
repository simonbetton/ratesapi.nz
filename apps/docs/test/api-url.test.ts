import { describe, expect, test } from "bun:test";

import { isApiPath, toApiUrl } from "../lib/api-url";

describe("toApiUrl", () => {
  test("points API Worker paths at the local API in development", () => {
    expect(toApiUrl("/openapi", "development")).toBe(
      "http://localhost:8787/openapi"
    );
    expect(toApiUrl("/openapi/json", "development")).toBe(
      "http://localhost:8787/openapi/json"
    );
    expect(toApiUrl("/api/v1/mortgage-rates", "development")).toBe(
      "http://localhost:8787/api/v1/mortgage-rates"
    );
  });

  test("keeps docs paths on the docs app in development", () => {
    expect(toApiUrl("/api-reference/quickstart", "development")).toBe(
      "/api-reference/quickstart"
    );
    expect(toApiUrl("/api/search", "development")).toBe("/api/search");
    expect(toApiUrl("/openapi-guide", "development")).toBe("/openapi-guide");
  });

  test("keeps relative API paths in production", () => {
    expect(toApiUrl("/openapi", "production")).toBe("/openapi");
    expect(toApiUrl("/openapi/json", "production")).toBe("/openapi/json");
  });
});

describe("isApiPath", () => {
  test("matches the paths that the API Worker serves", () => {
    expect(isApiPath("/openapi")).toBe(true);
    expect(isApiPath("/openapi/json")).toBe(true);
    expect(isApiPath("/api/v1/mcp")).toBe(true);
  });

  test("does not match docs paths", () => {
    expect(isApiPath("/")).toBe(false);
    expect(isApiPath("/api-reference")).toBe(false);
    expect(isApiPath("/api/search")).toBe(false);
    expect(isApiPath("/openapi-guide")).toBe(false);
    expect(isApiPath("/llms.txt")).toBe(false);
  });
});
