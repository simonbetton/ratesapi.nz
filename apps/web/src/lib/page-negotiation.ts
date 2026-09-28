// Content negotiation for the landing page Worker. Every page URL serves HTML
// to browsers and Markdown to agents that send Accept: text/markdown, as
// https://acceptmarkdown.com describes. It runs before TanStack Start, which
// answers 406 with a JSON body to any request that does not accept text/html.
// A client that accepts neither format gets 406 for a page that exists, and
// 404 for a path that does not, in JSON when it asks for JSON.

import { aboutPage } from "../content/about";
import { contactPage } from "../content/contact";
import { privacyPage } from "../content/privacy";
import { homepageMarkdown, notFoundMarkdown } from "./homepage-markdown";
import type { KeyFacts } from "./key-facts";
import { accepts, negotiate } from "./negotiation";
import { pageMarkdown } from "./page-content";
import { siteOrigin } from "./site-urls";

/** The text pages. Each one has a route in src/routes with the same path. */
export const contentPages = [aboutPage, contactPage, privacyPage];

// TanStack Start's server functions (TSS_SERVER_FN_BASE). They are not pages.
const serverFunctionBase = "/_serverFn/";

const markdownHeaders = {
  "Content-Type": "text/markdown; charset=utf-8",
  Vary: "Accept",
};

const notAcceptableBody = `This page is available in these formats:

- text/html
- text/markdown

Send an Accept header that allows one of them.
`;

const plainTextHeaders = {
  "Content-Type": "text/plain; charset=utf-8",
  Vary: "Accept",
};

// No part of the request is repeated in a 404, so a crafted URL cannot put
// text into what a client reads.
const notFoundText = `Not found. No page or endpoint has this address.

The pages of this site: ${siteOrigin}/sitemap.xml
The API endpoints: ${siteOrigin}/openapi.json
`;

// The same shape as the errors of the API Worker.
const notFoundJson = JSON.stringify({
  code: 404,
  error: "not_found",
  message: "No page or endpoint matches this path",
  hint: `The data endpoints start with /api/v1/. For all endpoints, refer to ${siteOrigin}/openapi.json. For all pages, refer to ${siteOrigin}/sitemap.xml.`,
  documentationUrl: `${siteOrigin}/docs/api-reference#endpoint-groups`,
});

export type PageNegotiation =
  /** Send this response: Markdown, a redirect, a 404, or a 406. */
  | { kind: "respond"; response: Response }
  /** Render the HTML page for this request, then vary it on Accept. */
  | { kind: "render"; request: Request }
  /** Not a page: hand the request to TanStack Start unchanged. */
  | { kind: "pass" };

// Like the HTML router, paths match without regard to case, and /about/ is
// the same page as /about.
function pagePath(pathname: string) {
  const path = pathname.toLowerCase();
  return path.length > 1 ? path.replace(/\/+$/u, "") : path;
}

function isPage(pathname: string) {
  const path = pagePath(pathname);
  return path === "/" || contentPages.some((page) => page.path === path);
}

/** The Markdown of a page, and its status: 404 for a page that does not exist. */
export async function markdownPage(
  pathname: string,
  loadFacts: () => Promise<KeyFacts | null>
) {
  const path = pagePath(pathname);
  if (path === "/") {
    return { status: 200, markdown: homepageMarkdown(await loadFacts()) };
  }
  const page = contentPages.find((candidate) => candidate.path === path);
  return page
    ? { status: 200, markdown: pageMarkdown(page) }
    : { status: 404, markdown: notFoundMarkdown };
}

function respond(
  request: Request,
  body: string,
  init: ResponseInit
): PageNegotiation {
  const isHead = request.method === "HEAD";
  return {
    kind: "respond",
    response: new Response(isHead ? null : body, init),
  };
}

async function markdownResponse(
  request: Request,
  url: URL,
  loadFacts: () => Promise<KeyFacts | null>
): Promise<PageNegotiation> {
  // The HTML router sends /about/ to /about with a 307. Do the same, so both
  // formats have one URL.
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    const location = new URL(url);
    location.pathname = url.pathname.replace(/\/+$/u, "") || "/";
    return respond(request, "", {
      status: 307,
      headers: { Location: location.toString(), Vary: "Accept" },
    });
  }

  const page = await markdownPage(url.pathname, loadFacts);
  return respond(request, page.markdown, {
    status: page.status,
    headers: markdownHeaders,
  });
}

function unacceptable(request: Request, url: URL): PageNegotiation {
  if (isPage(url.pathname)) {
    return respond(request, notAcceptableBody, {
      status: 406,
      headers: { ...plainTextHeaders, "Cache-Control": "no-store" },
    });
  }
  if (accepts(request.headers.get("Accept"), "application", "json")) {
    return respond(request, notFoundJson, {
      status: 404,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Vary: "Accept",
      },
    });
  }
  return respond(request, notFoundText, {
    status: 404,
    headers: plainTextHeaders,
  });
}

export async function negotiatePage(
  request: Request,
  loadFacts: () => Promise<KeyFacts | null>
): Promise<PageNegotiation> {
  const url = new URL(request.url);
  const isRead = request.method === "GET" || request.method === "HEAD";
  if (!isRead || url.pathname.startsWith(serverFunctionBase)) {
    return { kind: "pass" };
  }

  switch (negotiate(request.headers.get("Accept"))) {
    case "markdown": {
      return await markdownResponse(request, url, loadFacts);
    }
    case "html": {
      // The client accepts HTML, but maybe only through text/* or without
      // naming it, which TanStack Start would refuse.
      const headers = new Headers(request.headers);
      headers.set("Accept", "text/html");
      return { kind: "render", request: new Request(request, { headers }) };
    }
    default: {
      return unacceptable(request, url);
    }
  }
}

/** Adds Accept to the Vary header of a page that has two formats. */
export function varyOnAccept(response: Response) {
  const headers = new Headers(response.headers);
  const vary = headers.get("Vary");
  const fields = vary?.split(",").map((field) => field.trim().toLowerCase());
  if (fields?.includes("accept") || fields?.includes("*")) {
    return response;
  }
  headers.set("Vary", vary ? `${vary}, Accept` : "Accept");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
