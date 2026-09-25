const canonicalHost = "www.ratesapi.nz";
const apexHost = "ratesapi.nz";
// The docs used to be served from the apex root. They now live under /docs.
const legacyDocsPath =
  /^\/(?:(?:api-reference|open-source)(?:\/|$)|llms\.txt$)/u;

/**
 * Returns where to permanently redirect a request, or null to serve it.
 *
 * API paths never get here on the apex: the API Worker's routes run before this
 * Worker, so existing API and MCP clients keep working without a redirect.
 */
export function canonicalRedirect(requestUrl: string): string | null {
  const url = new URL(requestUrl);
  const isApex = url.hostname === apexHost;
  const isLegacyDocs = legacyDocsPath.test(url.pathname);

  if (!isApex && !isLegacyDocs) {
    return null;
  }

  if (isApex) {
    url.protocol = "https:";
    url.hostname = canonicalHost;
    url.port = "";
  }
  if (isLegacyDocs) {
    url.pathname = `/docs${url.pathname}`;
  }

  return url.toString();
}
