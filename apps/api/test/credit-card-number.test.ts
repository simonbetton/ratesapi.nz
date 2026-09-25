import { describe, expect, test } from "bun:test";

import { parseOptionalNumber } from "../bin/parse-optional-number";

describe("parseOptionalNumber", () => {
  test("preserves numeric zero for '0'", () => {
    expect(parseOptionalNumber("0")).toBe(0);
  });

  test("preserves numeric zero for '0.00'", () => {
    expect(parseOptionalNumber("0.00")).toBe(0);
  });

  test("parses a positive decimal value", () => {
    expect(parseOptionalNumber("21.95")).toBe(21.95);
  });

  test("returns null for empty text", () => {
    expect(parseOptionalNumber("")).toBeNull();
  });

  test("returns null for whitespace-only text", () => {
    expect(parseOptionalNumber("   ")).toBeNull();
  });

  test("returns null for a nonnumeric placeholder", () => {
    expect(parseOptionalNumber("N/A")).toBeNull();
  });
});
