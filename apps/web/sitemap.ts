// Writes /sitemap.xml for the pages of this Worker when Vite builds the site,
// and serves it in development. Each <lastmod> is the date of the last commit
// that changed the files the page is made from, like the docs sitemap
// (apps/docs/source.config.ts). A shallow clone does not have the full
// history, so its sitemap has no dates instead of incorrect dates.
//
// The docs Worker writes /docs/sitemap.xml for the docs pages. robots.txt
// lists both sitemaps.

import { execFileSync } from "node:child_process";

import type { Plugin } from "vite";

const origin = "https://www.ratesapi.nz";
// Vite keeps the directory of this file when it bundles the config.
const appDirectory = import.meta.dirname;

export interface SitemapPage {
  path: string;
  /** The files that make the page, relative to apps/web. */
  sources: string[];
}

export const sitemapPages: SitemapPage[] = [
  {
    path: "/",
    sources: ["src/routes/index.tsx", "src/components", "src/lib/key-facts.ts"],
  },
  // The API Worker serves the reference, and its text comes from the spec.
  {
    path: "/openapi",
    sources: [
      "../api/src/lib/openapi-page.ts",
      "../api/src/lib/openapi.ts",
      "../api/src/models",
      "../api/src/routes",
    ],
  },
  {
    path: "/about",
    sources: ["src/routes/about.tsx", "src/content/about.ts"],
  },
  {
    path: "/contact",
    sources: ["src/routes/contact.tsx", "src/content/contact.ts"],
  },
  {
    path: "/privacy",
    sources: ["src/routes/privacy.tsx", "src/content/privacy.ts"],
  },
];

export interface SitemapEntry {
  loc: string;
  lastmod: string | null;
}

const xmlEntities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

function escapeXml(value: string) {
  return value.replaceAll(
    /[&<>"']/gu,
    (character) => xmlEntities[character] ?? character
  );
}

/** A sitemap in the sitemaps.org 0.9 format. */
export function renderSitemap(entries: SitemapEntry[]) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map((entry) =>
      [
        "  <url>",
        `    <loc>${escapeXml(entry.loc)}</loc>`,
        ...(entry.lastmod ? [`    <lastmod>${entry.lastmod}</lastmod>`] : []),
        "  </url>",
      ].join("\n")
    ),
    "</urlset>",
    "",
  ].join("\n");
}

function git(...args: string[]) {
  return execFileSync("git", args, {
    cwd: appDirectory,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

/** The date of the last commit that changed any of the files, or null. */
export function lastCommitDate(sources: string[]): string | null {
  try {
    if (git("rev-parse", "--is-shallow-repository") !== "false") {
      return null;
    }
    const date = git("log", "-1", "--format=%cI", "--", ...sources);
    return date === "" ? null : new Date(date).toISOString();
  } catch {
    // Git is not available, for example in a source archive.
    return null;
  }
}

export function sitemapXml(lastModified = lastCommitDate) {
  return renderSitemap(
    sitemapPages.map((page) => ({
      loc: `${origin}${page.path}`,
      lastmod: lastModified(page.sources),
    }))
  );
}

export function sitemap(): Plugin {
  return {
    name: "ratesapi:sitemap",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== "/sitemap.xml") {
          next();
          return;
        }
        response.setHeader("Content-Type", "application/xml; charset=utf-8");
        response.end(sitemapXml());
      });
    },
    generateBundle() {
      // Only the browser build writes the public files.
      if (this.environment.name !== "client") {
        return;
      }
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: sitemapXml(),
      });
    },
  };
}
