import { docsBasePath } from "./base-path";

// The production origin. The landing page Worker serves the site root, and this
// app serves the docs under /docs.
export const siteOrigin = "https://www.ratesapi.nz";

export const siteName = "Rates API";

export const repositoryUrl = "https://github.com/simonbetton/ratesapi.nz";

// The default social card. The landing page Worker serves it.
export const socialImage = {
  url: `${siteOrigin}/images/og-card.png`,
  width: 1200,
  height: 630,
  alt: "Rates API: free New Zealand interest rates API",
  type: "image/png",
};

// Canonical URLs, the sitemap, JSON-LD and llms.txt need absolute URLs.
// Next.js does not add the base path to them. The docs root has no trailing
// slash: https://www.ratesapi.nz/docs.
export function toDocsUrl(pageUrl: string): string {
  const path = pageUrl === "/" ? "" : pageUrl;

  return `${siteOrigin}${docsBasePath}${path}`;
}

// For paths outside the docs, for example the API Worker paths.
export function toSiteUrl(path: string): string {
  return `${siteOrigin}${path}`;
}
