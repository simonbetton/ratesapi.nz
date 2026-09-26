import { ScalarRender } from "@elysia/openapi/scalar";

import { openApiDocumentation } from "./openapi";

// The Scalar API Reference bundle that GET /openapi loads. The version and the
// hash must change together. To update them:
//
//   1. Set `version` to the new release of @scalar/api-reference.
//   2. Set `integrity` to the output of:
//      curl -sL https://cdn.jsdelivr.net/npm/@scalar/api-reference@<version>/dist/browser/standalone.js \
//        | openssl dgst -sha384 -binary | openssl base64 -A
//      and put "sha384-" before it.
//   3. Run `bun test apps/api` and open /openapi in a browser.
//
// The file is the published `standalone.js`, not `standalone.min.js`:
// jsDelivr makes the .min.js file itself, so its bytes (and hash) can change.
export const scalarBundle = {
  version: "1.72.1",
  integrity:
    "sha384-U11tb2XnKvmwt8RlTvnwUnYgrN+ur4Xyh9htLhjajWNR/Oyl5AX5DEz00qRmlrmK",
} as const;

const scalarBundleUrl = `https://cdn.jsdelivr.net/npm/@scalar/api-reference@${scalarBundle.version}/dist/browser/standalone.js`;

const canonicalUrl = "https://www.ratesapi.nz/openapi";
const pageTitle = "NZ Interest Rates API Reference (OpenAPI) | Rates API";
const pageDescription =
  "Interactive OpenAPI reference for the free New Zealand interest rates API: every endpoint, parameter and response field.";

const pageHead = `
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${pageTitle}</title>
    <meta name="description" content="${pageDescription}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Rates API" />
    <meta property="og:title" content="${pageTitle}" />
    <meta property="og:description" content="${pageDescription}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="https://www.ratesapi.nz/images/og-card.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Rates API: free New Zealand interest rates API" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="theme-color" content="#1a2035" />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" href="/ratesapi-terminal-light.svg" type="image/svg+xml" media="(prefers-color-scheme: light)" />
    <link rel="icon" href="/ratesapi-terminal-dark.svg" type="image/svg+xml" media="(prefers-color-scheme: dark)" />
    `;

// Crawlers and readers without JavaScript get this summary. Scalar renders
// the full reference from /openapi/json in the browser.
const noscriptSummary = `<noscript>
      <main style="max-width: 48rem; margin: 0 auto; padding: 2rem 1rem; font-family: system-ui, sans-serif; line-height: 1.5">
        <h1>NZ Interest Rates API Reference (OpenAPI)</h1>
        <p>Rates API is a free JSON API for the interest rates of New Zealand banks and lenders: mortgages, personal loans, car loans and credit cards. You do not need an API key. Turn on JavaScript to see the interactive reference.</p>
        <h2>Endpoints</h2>
        <ul>
          <li><code>GET /api/v1/mortgage-rates</code>: the newest mortgage rates for all institutions.</li>
          <li><code>GET /api/v1/personal-loan-rates</code>: the newest personal loan rates.</li>
          <li><code>GET /api/v1/car-loan-rates</code>: the newest car loan rates.</li>
          <li><code>GET /api/v1/credit-card-rates</code>: the newest credit card rates and fees.</li>
          <li><code>GET /api/v1/mortgage-rates/time-series</code>: daily snapshots of earlier rates. Each dataset has a <code>/time-series</code> endpoint.</li>
          <li><code>GET /api/v1/health</code>: the API status, and the time of the last change and the last check of each dataset.</li>
          <li><code>POST /api/v1/mcp</code>: the Model Context Protocol (MCP) endpoint for AI agents.</li>
        </ul>
        <h2>More documentation</h2>
        <ul>
          <li><a href="https://www.ratesapi.nz/docs/api-reference/quickstart">Quickstart: your first API call</a></li>
          <li><a href="https://www.ratesapi.nz/docs/api-reference">API reference guides</a></li>
          <li><a href="/openapi/json">OpenAPI document (JSON)</a></li>
        </ul>
      </main>
    </noscript>`;

let page: string | undefined;

// The page does not change while the Worker runs, so it is built once for
// each isolate, on the first request.
export function openApiPage(): string {
  page ??= buildOpenApiPage();
  return page;
}

// ScalarRender gives the same page (and Elysia theme) as the openapi()
// plugin. Its <head> only has a title and the full API description, so this
// function replaces the head tags before the first <style>, adds a noscript
// summary, and loads the pinned bundle with defer and integrity.
function buildOpenApiPage(): string {
  const html = ScalarRender(
    {
      title: pageTitle,
      description: pageDescription,
      version: openApiDocumentation.info.version,
    },
    {
      url: "openapi/json",
      version: scalarBundle.version,
      cdn: scalarBundleUrl,
      _integration: "elysiajs",
    }
  );
  const headStart = requireIndex(html, "<head>") + "<head>".length;
  const firstStyle = requireIndex(html, "<style>", headStart);
  const configurationScript = '<script\n      id="api-reference"';
  const replacements: [search: string, replacement: string][] = [
    ["<html>", '<html lang="en">'],
    [configurationScript, `${noscriptSummary}\n    ${configurationScript}`],
    [
      `<script src="${scalarBundleUrl}" crossorigin></script>`,
      `<script src="${scalarBundleUrl}" integrity="${scalarBundle.integrity}" crossorigin defer></script>`,
    ],
  ];

  let result = `${html.slice(0, headStart)}${pageHead}${html.slice(firstStyle)}`;
  for (const [search, replacement] of replacements) {
    result = replaceOnce(result, search, replacement);
  }

  return result;
}

function requireIndex(html: string, search: string, fromIndex = 0): number {
  const index = html.indexOf(search, fromIndex);

  if (index === -1) {
    throw new Error(`Scalar page template changed: "${search}" not found`);
  }

  return index;
}

function replaceOnce(html: string, search: string, replacement: string) {
  const index = requireIndex(html, search);

  return `${html.slice(0, index)}${replacement}${html.slice(index + search.length)}`;
}
