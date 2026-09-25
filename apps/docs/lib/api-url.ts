// Paths that the API Worker serves. In production the API Worker shares the
// docs origin through route patterns, so relative links work. In local
// development the API runs on its own port.
const apiPathPattern = /^\/(?:openapi(?:[/?#]|$)|api\/v1\/)/u;
const localApiOrigin = "http://localhost:8787";

export function toApiUrl(
  href: string,
  environment = process.env.NODE_ENV
): string {
  if (environment !== "development" || !apiPathPattern.test(href)) {
    return href;
  }

  return `${localApiOrigin}${href}`;
}
