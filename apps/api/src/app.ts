import { openapi, toOpenAPISchema } from "@elysia/openapi";
import { cors } from "@elysiajs/cors";
import type { AnyElysia, ElysiaAdapter } from "elysia";
import { Elysia } from "elysia";

import { readDataSetFreshness } from "./lib/data-freshness";
import { createLogger } from "./lib/logging";
import { openApiDocumentation, toOpenApiDocument } from "./lib/openapi";
import type { OpenApiServer } from "./lib/openapi";
import { openApiPage } from "./lib/openapi-page";
import { responseHeaders } from "./lib/response-headers";
import type { GetEnv } from "./lib/routing";
import {
  apiError,
  HealthErrorResponse,
  HealthResponse,
  invalidRequestParameters,
} from "./models/api";
import type { ApiErrorBody } from "./models/api";
import {
  carLoanRatesRoutes,
  createMcpRoutes,
  creditCardRatesRoutes,
  mortgageRatesRoutes,
  personalLoanRatesRoutes,
} from "./routes";

const log = createLogger("rates-api");
const validationLog = createLogger("rates-api-validation");
const healthStatusOk = "ok";
const healthStatusError = "error";
const productionServer: OpenApiServer = {
  url: "https://www.ratesapi.nz",
  description: "Production",
};

export interface CreateAppOptions {
  adapter?: ElysiaAdapter;
}

export function createApp(getEnv: GetEnv, options: CreateAppOptions = {}) {
  const apiRoutes = new Elysia({ prefix: "/api/v1" })
    .use(
      cors({
        origin: "*",
        credentials: false,
        maxAge: 600,
      })
    )
    .use(mortgageRatesRoutes(getEnv))
    .use(personalLoanRatesRoutes(getEnv))
    .use(carLoanRatesRoutes(getEnv))
    .use(creditCardRatesRoutes(getEnv))
    .use(createMcpRoutes(getEnv))
    .get(
      "/health",
      async ({ status }) => {
        try {
          const dataSets = await readDataSetFreshness(getEnv().RATESAPI_DB);

          return {
            status: healthStatusOk,
            dataSets,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          log.error({ error }, "Health check failed");
          return status(500, {
            status: healthStatusError,
            message: "Unable to read data freshness",
            timestamp: new Date().toISOString(),
          });
        }
      },
      {
        response: {
          200: HealthResponse,
          500: HealthErrorResponse,
        },
        detail: {
          operationId: "getHealth",
          tags: ["Health"],
          summary: "Get the status of the API",
          description: [
            "This endpoint shows if the API can read its database. Use this endpoint to make sure that the API operates correctly.",
            "",
            "The API collects data each hour, but it saves a dataset only when the data changes. Thus, for each dataset, the response shows two times:",
            "",
            "- `lastUpdated` is the time of the last change to the data. This time can be old when the data is correct.",
            "- `lastChecked` is the time of the last correct data collection.",
            "",
            "`stale` is `true` when the API did not collect the dataset correctly in the last 3 hours. The `status` stays `ok` when a dataset is stale.",
          ].join("\n"),
        },
      }
    );

  const app = new Elysia({
    name: "rates-api",
    adapter: options.adapter,
  })
    .use(
      openapi({
        documentation: {
          ...openApiDocumentation,
          servers: [productionServer],
        },
        // The app serves the /openapi page itself (see below).
        provider: null,
      })
    )
    .use(responseHeaders)
    .onBeforeHandle({ as: "global" }, ({ request, set }) => {
      set.headers["x-request-id"] =
        request.headers.get("x-request-id") ?? crypto.randomUUID();
    })
    // Every error is JSON with the same shape as the endpoint errors, also
    // for a path that does not exist, so that clients and agents can read it.
    .onError({ as: "global" }, ({ code, error, status }) => {
      const body = errorBody(code, error);
      if (body === null) {
        return;
      }

      return status(body.code, body);
    })
    .use(apiRoutes)
    // /openapi.json is the conventional path, which agents and tools try
    // first. /openapi/json is the path of the openapi() plugin, and existing
    // clients use it. Both paths give the same document.
    .get(
      "/openapi.json",
      ({ request }): OpenApiDocument =>
        openApiDocument(app, request, getEnv().ENVIRONMENT),
      {
        detail: {
          hide: true,
        },
      }
    )
    .get(
      "/openapi/json",
      ({ request }): OpenApiDocument =>
        openApiDocument(app, request, getEnv().ENVIRONMENT),
      {
        detail: {
          hide: true,
        },
      }
    )
    .get(
      "/openapi",
      () =>
        new Response(openApiPage(), {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      {
        detail: {
          hide: true,
        },
      }
    );

  return app;
}

// The JSON body for an error that Elysia raises, or null for a custom status
// that a handler set, which keeps its own response.
function errorBody(code: number | string, error: unknown): ApiErrorBody | null {
  switch (code) {
    case "VALIDATION":
    case "PARSE": {
      validationLog.warn({ error }, "Request validation failed");
      return invalidRequestParameters();
    }
    case "NOT_FOUND": {
      return apiError("not_found", "No endpoint matches this method and path");
    }
    case "UNKNOWN":
    case "INTERNAL_SERVER_ERROR": {
      log.error({ error }, "Unhandled error");
      return apiError("server_error", "An unexpected error occurred");
    }
    default: {
      return null;
    }
  }
}

type OpenApiDocument = ReturnType<typeof toOpenApiDocument>;

function openApiDocument(
  app: AnyElysia,
  request: Request,
  environment: string | undefined
): OpenApiDocument {
  return toOpenApiDocument(
    toOpenAPISchema(app),
    getOpenApiServers(request, environment)
  );
}

function getOpenApiServers(
  request: Request,
  environment: string | undefined
): OpenApiServer[] {
  const { origin } = new URL(request.url);
  const currentServer = {
    url: origin,
    description: environment === "production" ? "Production" : "Local",
  };

  if (origin === productionServer.url) {
    return [currentServer];
  }

  return [currentServer, productionServer];
}
