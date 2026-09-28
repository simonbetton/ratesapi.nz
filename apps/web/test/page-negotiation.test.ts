import { describe, expect, test } from "bun:test";

import type { KeyFacts } from "../src/lib/key-facts";
import {
  contentPages,
  markdownPage,
  negotiatePage,
  varyOnAccept,
} from "../src/lib/page-negotiation";

const facts: KeyFacts = {
  mortgageLenders: 36,
  personalLoanLenders: 39,
  carLoanLenders: 32,
  creditCardIssuers: 33,
  lastUpdated: "2026-09-25T07:57:32.965Z",
  historyStart: "2025-03-08",
};

async function loadFacts() {
  return facts;
}

function negotiateRequest(path: string, init: RequestInit = {}) {
  return negotiatePage(
    new Request(`https://www.ratesapi.nz${path}`, init),
    loadFacts
  );
}

async function respond(path: string, accept: string, method = "GET") {
  const page = await negotiateRequest(path, {
    method,
    headers: { Accept: accept },
  });
  if (page.kind !== "respond") {
    throw new Error(`Expected a response for ${path}, got ${page.kind}`);
  }
  return page.response;
}

describe("Markdown for agents", () => {
  test("answers the homepage with Markdown, Content-Type and Vary", async () => {
    const response = await respond("/", "text/markdown");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8"
    );
    expect(response.headers.get("Vary")).toBe("Accept");
    expect(body.startsWith("# Rates API\n\n> ")).toBe(true);
    expect(body).toContain("36 mortgage lenders");
  });

  test.each(contentPages.map((page) => [page.path]))(
    "answers %s with its Markdown",
    async (path) => {
      const response = await respond(path, "text/markdown, text/html;q=0.8");
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe(
        "text/markdown; charset=utf-8"
      );
      expect(body.length).toBeGreaterThan(500);
    }
  );

  test("answers a path that does not exist with a Markdown 404", async () => {
    const response = await respond(
      "/__ora-404-probe-iqdkk0s5",
      "text/markdown"
    );
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8"
    );
    expect(response.headers.get("Vary")).toBe("Accept");
    expect(body).toContain("(https://www.ratesapi.nz/docs)");
    expect(body).toContain("(https://www.ratesapi.nz/sitemap.xml)");
    expect(body).toContain("(https://www.ratesapi.nz/docs/llms.txt)");
    // The path is not repeated, so a link cannot put text into the page.
    expect(body).not.toContain("ora-404-probe");
  });

  test("answers the Accept header of Claude Code with Markdown", async () => {
    const response = await respond("/", "text/markdown, text/html");

    expect(response.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8"
    );
  });

  test("matches paths without regard to case, like the router", async () => {
    const page = await markdownPage("/About", loadFacts);
    expect(page.status).toBe(200);
  });

  test("redirects a trailing slash with a 307, like the router", async () => {
    const response = await respond("/about/?ref=agent", "text/markdown");

    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toBe(
      "https://www.ratesapi.nz/about?ref=agent"
    );
  });

  test("answers HEAD with the headers and no body", async () => {
    const response = await respond("/privacy", "text/markdown", "HEAD");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8"
    );
    expect(response.body).toBeNull();
  });
});

describe("HTML for browsers", () => {
  test.each([
    "text/html",
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "*/*",
    "text/*",
    "text/markdown;q=0",
  ])(
    "renders HTML for Accept: %s, with an Accept that the renderer takes",
    async (accept) => {
      const page = await negotiateRequest("/", { headers: { Accept: accept } });

      expect(page.kind).toBe("render");
      if (page.kind === "render") {
        expect(page.request.headers.get("Accept")).toBe("text/html");
        expect(page.request.url).toBe("https://www.ratesapi.nz/");
      }
    }
  );

  test("renders HTML when there is no Accept header", async () => {
    const page = await negotiateRequest("/about");
    expect(page.kind).toBe("render");
  });
});

describe("requests that are not negotiated", () => {
  test("answers 406 in plain text when neither format is acceptable", async () => {
    const response = await respond("/", "application/json");

    expect(response.status).toBe(406);
    expect(response.headers.get("Content-Type")).toBe(
      "text/plain; charset=utf-8"
    );
    expect(response.headers.get("Vary")).toBe("Accept");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toContain("text/markdown");
  });

  test("answers 406 for a page that exists, whatever its case or slash", async () => {
    const responses = await Promise.all(
      ["/", "/About", "/privacy/"].map((path) =>
        respond(path, "application/json")
      )
    );
    expect(responses.map((response) => response.status)).toEqual([
      406, 406, 406,
    ]);
  });

  test("answers a missing path with a JSON 404 when the client wants JSON", async () => {
    const response = await respond("/swagger.json", "application/json");

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe(
      "application/json; charset=utf-8"
    );
    expect(response.headers.get("Vary")).toBe("Accept");
    expect(await response.json()).toEqual({
      code: 404,
      error: "not_found",
      message: "No page or endpoint matches this path",
      hint: "The data endpoints start with /api/v1/. For all endpoints, refer to https://www.ratesapi.nz/openapi.json. For all pages, refer to https://www.ratesapi.nz/sitemap.xml.",
      documentationUrl:
        "https://www.ratesapi.nz/docs/api-reference#endpoint-groups",
    });
  });

  test("answers a missing path with a plain-text 404 otherwise", async () => {
    const response = await respond("/.well-known/security.txt", "text/plain");
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe(
      "text/plain; charset=utf-8"
    );
    expect(body).toContain("https://www.ratesapi.nz/sitemap.xml");
    expect(body).not.toContain("security.txt");
  });

  test("passes server functions and non-GET requests to TanStack Start", async () => {
    const serverFunction = await negotiateRequest("/_serverFn/abc123", {
      headers: { Accept: "application/json" },
    });
    const post = await negotiateRequest("/", {
      method: "POST",
      headers: { Accept: "text/markdown" },
    });

    expect(serverFunction.kind).toBe("pass");
    expect(post.kind).toBe("pass");
  });
});

describe("varyOnAccept", () => {
  test("adds Accept to Vary, keeping the fields that are there", () => {
    const plain = varyOnAccept(new Response("page"));
    const withOrigin = varyOnAccept(
      new Response("page", { headers: { Vary: "Origin" } })
    );

    expect(plain.headers.get("Vary")).toBe("Accept");
    expect(withOrigin.headers.get("Vary")).toBe("Origin, Accept");
  });

  test("leaves a response that already varies on Accept or on everything", () => {
    for (const vary of ["accept", "Origin, Accept", "*"]) {
      const response = new Response("page", { headers: { Vary: vary } });
      expect(varyOnAccept(response)).toBe(response);
    }
  });

  test("keeps the status and the body", async () => {
    const response = varyOnAccept(
      new Response("missing", { status: 404, statusText: "Not Found" })
    );

    expect(response.status).toBe(404);
    expect(response.statusText).toBe("Not Found");
    expect(await response.text()).toBe("missing");
  });
});
