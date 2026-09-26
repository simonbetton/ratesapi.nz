import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

import { canonicalRedirect } from "./lib/canonical-url";

// Static assets skip this Worker; public/_headers gives them the same set.
const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'",
};
// Browsers revalidate each visit; shared caches may reuse a page for a minute.
const htmlCacheControl = "public, max-age=0, s-maxage=60";

/** Adds the site-wide headers, keeping any the response already set. */
function withSiteHeaders(response: Response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders)) {
    if (!headers.has(name)) {
      headers.set(name, value);
    }
  }
  const isPage =
    response.status === 200 &&
    headers.get("Content-Type")?.startsWith("text/html") === true;
  if (isPage && !headers.has("Cache-Control")) {
    headers.set("Cache-Control", htmlCacheControl);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default createServerEntry({
  async fetch(request, ...rest) {
    const location = canonicalRedirect(request.url);
    if (location !== null) {
      return withSiteHeaders(Response.redirect(location, 301));
    }

    return withSiteHeaders(await handler.fetch(request, ...rest));
  },
});
