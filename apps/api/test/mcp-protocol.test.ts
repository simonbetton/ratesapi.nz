import { describe, expect, test } from "bun:test";

import {
  decodeHeaderValue,
  negotiateLegacyVersion,
  resolveEra,
} from "../src/routes/mcp/protocol";

describe("MCP header value decoding", () => {
  test("returns plain ASCII values as they are", () => {
    expect(decodeHeaderValue("list_mortgage_rates")).toBe(
      "list_mortgage_rates"
    );
  });

  test("decodes the Base64 sentinel form as UTF-8", () => {
    expect(decodeHeaderValue("=?base64?SGVsbG8sIOS4lueVjA==?=")).toBe(
      "Hello, 世界"
    );
  });

  test("rejects control characters and malformed Base64", () => {
    expect(decodeHeaderValue("line1\nline2")).toBeNull();
    expect(decodeHeaderValue("=?base64?%%%?=")).toBeNull();
    // Valid Base64 that is not valid UTF-8.
    expect(decodeHeaderValue(`=?base64?${btoa("ÿþ")}?=`)).toBeNull();
  });
});

describe("MCP protocol era", () => {
  test("negotiates legacy versions for initialize", () => {
    expect(negotiateLegacyVersion("2025-06-18")).toBe("2025-06-18");
    expect(negotiateLegacyVersion("2026-07-28")).toBe("2025-11-25");
    expect(negotiateLegacyVersion(42)).toBe("2025-11-25");
  });

  test("serves headerless requests as a 2025-03-26 legacy client", () => {
    expect(resolveEra(null, "tools/list", {})).toEqual({
      kind: "legacy",
      version: "2025-03-26",
    });
  });

  test("serves per-request _meta as the modern revision", () => {
    expect(
      resolveEra("2026-07-28", "tools/list", {
        _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" },
      })
    ).toEqual({ kind: "modern", version: "2026-07-28" });
  });

  test("keeps initialize on the legacy path", () => {
    expect(resolveEra("2026-07-28", "initialize", {})).toEqual({
      kind: "legacy",
      version: "2025-11-25",
    });
  });
});
