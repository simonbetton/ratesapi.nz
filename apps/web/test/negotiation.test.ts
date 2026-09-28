import { describe, expect, test } from "bun:test";

import { accepts, negotiate, parseAccept } from "../src/lib/negotiation";

describe("negotiate", () => {
  // The test vectors of https://acceptmarkdown.com/guides/accept-parsing for
  // a server that makes both Markdown and HTML.
  test.each([
    ["text/markdown", "markdown"],
    ["text/markdown, text/html;q=0.8", "markdown"],
    ["text/html", "html"],
    ["text/markdown;q=0, text/html", "html"],
    ["text/markdown;q=0", "html"],
    ["*/*", "html"],
  ] as const)("serves %p as %p", (accept, expected) => {
    expect(negotiate(accept)).toBe(expected);
  });

  test("serves HTML when there is no Accept header, or an empty one", () => {
    expect(negotiate(null)).toBe("html");
    expect(negotiate("")).toBe("html");
    expect(negotiate("  ")).toBe("html");
  });

  test("serves HTML to browsers, even though they accept */*", () => {
    expect(
      negotiate(
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
      )
    ).toBe("html");
    expect(negotiate("text/html, */*; q=0.01")).toBe("html");
  });

  test("serves Markdown to agents that prefer it", () => {
    expect(negotiate("text/markdown, text/plain;q=0.5, */*;q=0.1")).toBe(
      "markdown"
    );
    expect(negotiate("text/markdown;q=0.9, text/html;q=0.8")).toBe("markdown");
    expect(negotiate("text/html;q=0.5, text/markdown")).toBe("markdown");
  });

  test("gives Markdown to a client that names it with the same q as HTML", () => {
    // The header that Claude Code and OpenCode send.
    expect(negotiate("text/markdown, text/html")).toBe("markdown");
    expect(negotiate("text/markdown, text/html, */*")).toBe("markdown");
    expect(negotiate("text/html, text/markdown")).toBe("markdown");
    expect(negotiate("text/markdown;q=0.5, text/html;q=0.5")).toBe("markdown");
    expect(negotiate("text/markdown, */*")).toBe("markdown");
    expect(negotiate("text/markdown, text/*")).toBe("markdown");
  });

  test("gives HTML when a wildcard matches both types equally", () => {
    expect(negotiate("text/*")).toBe("html");
    expect(negotiate("text/*, */*;q=0.5")).toBe("html");
  });

  test("uses the most specific range for each type", () => {
    expect(negotiate("text/*;q=0.5, text/html;q=0")).toBe("markdown");
    expect(negotiate("text/markdown;q=0, */*")).toBe("html");
  });

  test("sends Markdown when only HTML is excluded", () => {
    expect(negotiate("text/html;q=0")).toBe("markdown");
  });

  test("gives no representation when the client accepts neither", () => {
    expect(negotiate("application/json")).toBeNull();
    expect(negotiate("application/pdf, image/*")).toBeNull();
    expect(negotiate("text/plain")).toBeNull();
    expect(negotiate("*/*;q=0")).toBeNull();
    expect(negotiate("text/*;q=0")).toBeNull();
  });

  test("ignores case, spaces, and media type parameters", () => {
    expect(negotiate("Text/Markdown ; charset=UTF-8")).toBe("markdown");
    expect(negotiate("TEXT/MARKDOWN;Q=0.9, text/html;q=0.1")).toBe("markdown");
    expect(negotiate("text/markdown;variant=GFM;q=0.7, text/html;q=0.6")).toBe(
      "markdown"
    );
  });

  test("skips ranges that it cannot read", () => {
    expect(negotiate("text/markdown;q=2, text/html")).toBe("html");
    expect(negotiate("text/markdown;q=abc")).toBe("html");
    expect(negotiate("*/markdown, garbage, text/markdown")).toBe("markdown");
  });
});

describe("accepts", () => {
  test("tells whether a type has a q-value above 0", () => {
    expect(accepts("application/json", "application", "json")).toBe(true);
    expect(accepts("application/*;q=0.2", "application", "json")).toBe(true);
    expect(accepts("*/*", "application", "json")).toBe(true);
    expect(accepts("application/json;q=0", "application", "json")).toBe(false);
    expect(accepts("text/plain", "application", "json")).toBe(false);
    expect(accepts(null, "application", "json")).toBe(false);
  });
});

describe("parseAccept", () => {
  test("reads the type, the subtype, and the q-value of each range", () => {
    expect(parseAccept("text/markdown, text/html;q=0.8, */*;q=0")).toEqual([
      { type: "text", subtype: "markdown", q: 1 },
      { type: "text", subtype: "html", q: 0.8 },
      { type: "*", subtype: "*", q: 0 },
    ]);
  });
});
