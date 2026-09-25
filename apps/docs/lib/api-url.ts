// Paths that the API Worker serves. In production the API Worker shares the
// docs origin through route patterns, so relative links work. In local
// development the API runs on its own port.
const apiPathPattern = /^\/(?:openapi(?:[/?#]|$)|api\/v1\/)/u;
const localApiOrigin = "http://localhost:8787";

// API paths are outside the docs basePath, so they must not go through
// next/link, which would prefix them with /docs.
export function isApiPath(href: string): boolean {
  return apiPathPattern.test(href);
}

export function toApiUrl(
  href: string,
  environment = process.env.NODE_ENV
): string {
  if (environment !== "development" || !isApiPath(href)) {
    return href;
  }

  return `${localApiOrigin}${href}`;
}
