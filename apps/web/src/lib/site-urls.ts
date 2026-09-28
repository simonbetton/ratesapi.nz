// In production the landing page, docs, and API share one origin: the API
// Worker claims /api/v1/* and /openapi*, the docs Worker claims /docs*, and the
// landing page serves everything else. Locally each app runs on its own dev
// server (see the docs' local development page), so links point at those
// instead.
const productionOrigin = "https://www.ratesapi.nz";
const localApiOrigin = "http://localhost:8787";
const localDocsOrigin = "http://localhost:3000";
// Keep in sync with basePath in apps/docs/next.config.mjs.
const docsBasePath = "/docs";

export function siteOrigins(isDevelopment: boolean) {
  return {
    api: isDevelopment ? localApiOrigin : productionOrigin,
    docs: `${isDevelopment ? localDocsOrigin : productionOrigin}${docsBasePath}`,
  };
}

// Agents read the Markdown pages without a base URL, and search engines read
// the sitemap, so their links always use the production origin.
export const siteOrigin = productionOrigin;

const origins = siteOrigins(import.meta.env.DEV === true);

export const apiOrigin = origins.api;

export function apiUrl(path: string) {
  return `${origins.api}${path}`;
}

export function docsUrl(path: string) {
  return `${origins.docs}${path}`;
}
