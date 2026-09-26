const canonicalHost = "www.ratesapi.nz";
const apexHost = "ratesapi.nz";
// The docs' first home. Every path on it moved under /docs on www.
const legacyDocsHost = "docs.ratesapi.nz";
// The docs used to be served from the apex root. They now live under /docs.
const legacyDocsPath =
  /^\/(?:(?:api-reference|open-source)(?:\/|$)|llms(?:-full)?\.txt$)/u;
// The old introduction page became the API reference overview.
const legacyIntroductionPath = /^\/api-reference\/introduction\/?$/u;
// The old per-endpoint pages are covered by the OpenAPI reference.
const legacyEndpointPath = /^\/api-reference\/endpoint(?:\/|$)/u;

/** Where a page from the old docs now lives on the canonical host. */
function movedDocsPath(pathname: string) {
  if (pathname === "/") {
    return "/docs";
  }
  if (legacyIntroductionPath.test(pathname)) {
    return "/docs/api-reference";
  }
  if (legacyEndpointPath.test(pathname)) {
    return "/openapi";
  }
  return `/docs${pathname}`;
}

/**
 * Returns where to permanently redirect a request, or null to serve it.
 *
 * API paths never get here on the apex: the API Worker's routes run before this
 * Worker, so existing API and MCP clients keep working without a redirect.
 */
export function canonicalRedirect(requestUrl: string): string | null {
  const url = new URL(requestUrl);
  const isApex = url.hostname === apexHost;
  const isLegacyDocsHost = url.hostname === legacyDocsHost;
  const isLegacyDocs = isLegacyDocsHost || legacyDocsPath.test(url.pathname);

  if (!isApex && !isLegacyDocs) {
    return null;
  }

  if (isApex || isLegacyDocsHost) {
    url.protocol = "https:";
    url.hostname = canonicalHost;
    url.port = "";
  }
  if (isLegacyDocs) {
    url.pathname = movedDocsPath(url.pathname);
  }

  return url.toString();
}
