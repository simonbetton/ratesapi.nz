import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";

import {
  lastCommitDate,
  renderSitemap,
  sitemapPages,
  sitemapXml,
} from "../sitemap";
import { integrationNotes } from "../src/components/rates-api-content";
import {
  homepageMarkdown,
  notFoundMarkdown,
} from "../src/lib/homepage-markdown";
import type { KeyFacts } from "../src/lib/key-facts";
import { inlineMarkdown, pageMarkdown } from "../src/lib/page-content";
import type { ContentPage, Inline } from "../src/lib/page-content";
import { contentPages } from "../src/lib/page-negotiation";

const facts: KeyFacts = {
  mortgageLenders: 36,
  personalLoanLenders: 39,
  carLoanLenders: 32,
  creditCardIssuers: 33,
  lastUpdated: "2026-09-25T07:57:32.965Z",
  historyStart: "2025-03-08",
};

// The paths of the file routes in src/routes, e.g. about.tsx is /about.
const routePaths = readdirSync(new URL("../src/routes", import.meta.url))
  .filter((file) => file.endsWith(".tsx") && !file.startsWith("__"))
  .map((file) => {
    const name = file.replace(/\.tsx$/u, "");
    return name === "index" ? "/" : `/${name}`;
  })
  .toSorted();

function plainText(content: Inline[]) {
  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      return "code" in part ? part.code : part.text;
    })
    .join("");
}

function pageText(page: ContentPage) {
  return [
    plainText(page.lede),
    ...page.blocks.map((block) => {
      if (block.kind === "heading") {
        return block.text;
      }
      return block.kind === "paragraph"
        ? plainText(block.content)
        : block.items.map(plainText).join(" ");
    }),
  ].join(" ");
}

function links(page: ContentPage) {
  const inline = [
    page.lede,
    ...page.blocks.flatMap((block) => {
      if (block.kind === "paragraph") {
        return [block.content];
      }
      return block.kind === "list" ? block.items : [];
    }),
  ].flat();
  return inline.flatMap((part) =>
    typeof part === "object" && "href" in part ? [part.href] : []
  );
}

describe("pages", () => {
  test("gives every page route a Markdown version and a sitemap entry", () => {
    const markdownPaths = ["/", ...contentPages.map((page) => page.path)];

    expect(markdownPaths.toSorted()).toEqual(routePaths);
    // /openapi is the API Worker's page; this sitemap lists it too.
    expect(sitemapPages.map((page) => page.path).toSorted()).toEqual(
      [...routePaths, "/openapi"].toSorted()
    );
  });

  test.each(contentPages.map((page) => [page.path, page]))(
    "%s has enough text for people and agents to trust it",
    (_path, page) => {
      expect(pageText(page).length).toBeGreaterThan(500);
      expect(page.description.length).toBeGreaterThan(50);
      expect(page.description.length).toBeLessThanOrEqual(160);
    }
  );

  test("links only to pages that exist", () => {
    for (const page of contentPages) {
      for (const href of links(page)) {
        if (href.startsWith("/")) {
          expect(routePaths).toContain(href);
        } else {
          expect(href).toStartWith("https://");
        }
      }
    }
  });
});

describe("pageMarkdown", () => {
  const page: ContentPage = {
    path: "/example",
    schemaType: "WebPage",
    title: "Example page",
    eyebrow: "Example",
    description: "A page to test the Markdown.",
    lede: ["The first paragraph."],
    blocks: [
      { kind: "heading", text: "A section" },
      {
        kind: "paragraph",
        content: [
          "Read ",
          { text: "the privacy notice", href: "/privacy" },
          " or send ",
          { code: "GET /api/v1/health" },
          ".",
        ],
      },
      { kind: "list", items: [["One *item*"], ["Two_items"]] },
    ],
    updated: "2026-09-28",
  };

  test("gives the title, the summary, the content, and the date", () => {
    expect(pageMarkdown(page)).toBe(
      [
        "# Example page",
        "> A page to test the Markdown.",
        "The first paragraph.",
        "## A section",
        "Read [the privacy notice](https://www.ratesapi.nz/privacy) or send `GET /api/v1/health`.",
        String.raw`- One \*item\*
- Two\_items`,
        "Last updated: 28 September 2026\n",
      ].join("\n\n")
    );
  });

  test("keeps external links as they are", () => {
    expect(
      inlineMarkdown([{ text: "GitHub", href: "https://github.com/" }])
    ).toBe("[GitHub](https://github.com/)");
  });
});

describe("homepageMarkdown", () => {
  const markdown = homepageMarkdown(facts);

  test("has the sections of the homepage", () => {
    for (const heading of [
      "# Rates API",
      "## Key facts",
      "## When to use Rates API",
      "## Endpoints",
      "## Quick start",
      "## For AI agents",
      "## Before you ship",
    ]) {
      expect(markdown.split("\n")).toContain(heading);
    }
  });

  test("uses the live key facts", () => {
    expect(markdown).toContain("| Mortgage lenders | 36 |");
    expect(markdown).toContain("since 8 March 2025");
    expect(homepageMarkdown(null)).toContain("30+ lenders");
  });

  test("tells agents when to use the API and how to call it", () => {
    expect(markdown).toContain(
      "`GET https://www.ratesapi.nz/api/v1/mortgage-rates?termInMonths=12`"
    );
    expect(markdown).toContain("`POST https://www.ratesapi.nz/api/v1/mcp`");
    expect(markdown).toContain(
      "Do not use Rates API for rates outside New Zealand"
    );
    expect(markdown).toContain("(https://www.ratesapi.nz/openapi.json)");
  });

  test("lists the three endpoints of each dataset", () => {
    expect(markdown).toContain(
      "| `/api/v1/credit-card-rates` | `/api/v1/credit-card-rates/{issuerId}` | `/api/v1/credit-card-rates/time-series` |"
    );
    expect(markdown).toContain("`/api/v1/mortgage-rates/{institutionId}`");
  });

  test("answers the same questions as the HTML page", () => {
    for (const note of integrationNotes) {
      expect(markdown).toContain(
        `### ${note.question}\n\n${inlineMarkdown(note.answer)}`
      );
    }
  });

  test("uses absolute links only", () => {
    for (const match of markdown.matchAll(/\]\((?<href>[^)]+)\)/gu)) {
      expect(match.groups?.href).toStartWith("https://");
    }
  });
});

describe("notFoundMarkdown", () => {
  test("explains the error and links to the docs, llms.txt, and the sitemap", () => {
    expect(notFoundMarkdown.startsWith("# Page not found\n\n")).toBe(true);
    expect(notFoundMarkdown.length).toBeGreaterThan(20);
    for (const url of [
      "https://www.ratesapi.nz/docs",
      "https://www.ratesapi.nz/docs/llms.txt",
      "https://www.ratesapi.nz/sitemap.xml",
    ]) {
      expect(notFoundMarkdown).toContain(`(${url})`);
    }
  });
});

describe("sitemap", () => {
  test("uses the sitemaps.org format, with a lastmod when there is one", () => {
    expect(
      renderSitemap([
        {
          loc: "https://www.ratesapi.nz/",
          lastmod: "2026-09-28T01:02:03.000Z",
        },
        { loc: "https://www.ratesapi.nz/about?a=1&b=2", lastmod: null },
      ])
    ).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        "  <url>",
        "    <loc>https://www.ratesapi.nz/</loc>",
        "    <lastmod>2026-09-28T01:02:03.000Z</lastmod>",
        "  </url>",
        "  <url>",
        "    <loc>https://www.ratesapi.nz/about?a=1&amp;b=2</loc>",
        "  </url>",
        "</urlset>",
        "",
      ].join("\n")
    );
  });

  test("dates each page from the files it is made from", () => {
    const seen: string[][] = [];
    const xml = sitemapXml((sources) => {
      seen.push(sources);
      return "2026-09-28T00:00:00.000Z";
    });

    expect(seen).toEqual(sitemapPages.map((page) => page.sources));
    expect(xml.match(/<lastmod>/gu)?.length).toBe(sitemapPages.length);
    expect(xml).toContain("<loc>https://www.ratesapi.nz/privacy</loc>");
  });

  test("reads commit dates as ISO 8601, or gives none without history", () => {
    const date = lastCommitDate(["package.json"]);
    // CI checks out a shallow clone, which has no reliable dates.
    if (date !== null) {
      expect(new Date(date).toISOString()).toBe(date);
    }
    expect(lastCommitDate(["no-such-file.ts"])).toBeNull();
  });
});
