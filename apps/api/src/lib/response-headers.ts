import { Elysia, ElysiaCustomStatusResponse } from "elysia";

// All response headers that depend on the path or the status are set here.
//
// - Every response gets `nosniff` and a referrer policy. JSON clients ignore
//   them. Error responses (404, validation errors) get them too, because
//   onRequest runs before routing.
// - GET /api/v1/* and GET /openapi/json get `X-Robots-Tag: noindex`, so
//   search engines do not index raw JSON.
// - Successful GET responses of the dataset endpoints (list, by-id and
//   time-series) and /openapi/json get a short `Cache-Control`, because the
//   data changes at most once each hour. Errors are not cached. The health
//   endpoint is not cached, because monitors need a fresh answer. MCP is not
//   cached.

const securityHeaders = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
};

const noindexHeaders = { "x-robots-tag": "noindex" };

const cacheHeaders = { "cache-control": "public, max-age=300" };

const jsonPath = /^\/(?:api\/v1\/|openapi\/json\/?$)/u;
const cacheablePath =
  /^\/(?:api\/v1\/(?:mortgage|personal-loan|car-loan|credit-card)-rates(?:\/|$)|openapi\/json\/?$)/u;

export const responseHeaders = new Elysia({ name: "response-headers" })
  .onRequest(({ request, set }) => {
    Object.assign(set.headers, securityHeaders);

    if (isRead(request) && jsonPath.test(new URL(request.url).pathname)) {
      Object.assign(set.headers, noindexHeaders);
    }
  })
  // afterHandle runs only when a handler returns. Validation errors and
  // unknown paths go to onError, so they never get Cache-Control.
  .onAfterHandle({ as: "global" }, ({ request, responseValue, set }) => {
    const status = responseStatus(responseValue, set.status);

    if (
      isRead(request) &&
      status !== undefined &&
      status >= 200 &&
      status < 300 &&
      cacheablePath.test(new URL(request.url).pathname)
    ) {
      Object.assign(set.headers, cacheHeaders);
    }
  });

function isRead(request: Request): boolean {
  return request.method === "GET" || request.method === "HEAD";
}

function responseStatus(
  responseValue: unknown,
  status: number | string | undefined
): number | undefined {
  if (responseValue instanceof Response) {
    return responseValue.status;
  }

  if (responseValue instanceof ElysiaCustomStatusResponse) {
    return typeof responseValue.code === "number"
      ? responseValue.code
      : undefined;
  }

  return typeof status === "number" ? status : undefined;
}
