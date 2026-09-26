/* oxlint-disable no-console -- a CLI script that reports to the terminal */
// Asks IndexNow search engines (Bing, Yandex, Seznam and others) to recrawl
// the site's canonical URLs. Run it after a deploy:
//
//   bun run indexnow            # submit the URLs
//   bun run indexnow --dry-run  # print what would be submitted
//
// It never fails a deploy: every problem is reported as a warning and the
// script still exits 0.

import { argv } from "node:process";

const host = "www.ratesapi.nz";
// Must match the key file served from public/, i.e. https://<host>/<key>.txt.
const key = "715cf3e6b8b0a37f937b6df57dd90710";
const keyLocation = `https://${host}/${key}.txt`;
const endpoint = "https://api.indexnow.org/indexnow";
const sitemaps = [
  `https://${host}/sitemap.xml`,
  `https://${host}/docs/sitemap.xml`,
];
// Submitted even if a sitemap can't be read.
const coreUrls = [
  `https://${host}/`,
  `https://${host}/openapi`,
  `https://${host}/docs`,
];
const timeoutMs = 15_000;
const userAgent = "RatesAPI/IndexNow";

async function sitemapUrls(sitemap: string): Promise<string[]> {
  try {
    const response = await fetch(sitemap, {
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      console.warn(`IndexNow: skipped ${sitemap} (HTTP ${response.status})`);
      return [];
    }
    const xml = await response.text();
    return [...xml.matchAll(/<loc>\s*(?<loc>[^<\s]+)\s*<\/loc>/gu)].flatMap(
      (match) => (match.groups?.loc ? [match.groups.loc] : [])
    );
  } catch (error) {
    console.warn(`IndexNow: skipped ${sitemap} (${String(error)})`);
    return [];
  }
}

async function main() {
  const found = await Promise.all(sitemaps.map(sitemapUrls));
  // IndexNow rejects the whole batch if any URL is on another host.
  const urlList = [...new Set([...coreUrls, ...found.flat()])].filter(
    (url) => new URL(url).host === host
  );
  const body = { host, key, keyLocation, urlList };

  if (argv.includes("--dry-run")) {
    console.log(JSON.stringify(body, null, 2));
    return;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": userAgent,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.ok) {
      console.log(
        `IndexNow: submitted ${urlList.length} URLs (HTTP ${response.status})`
      );
    } else {
      const detail = await response.text();
      console.warn(
        `IndexNow: submission not accepted (HTTP ${response.status}) ${detail.slice(0, 300)}`
      );
    }
  } catch (error) {
    console.warn(`IndexNow: submission failed (${String(error)})`);
  }
}

await main();
