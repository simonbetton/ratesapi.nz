import { openapi, toOpenAPISchema } from "@elysia/openapi";
import { cors } from "@elysiajs/cors";
import { Elysia, type ElysiaAdapter } from "elysia";
import { renderDocsRoute, renderDocsSearch, renderLlmsTxt } from "./docs/html";
import { docsRoutes } from "./docs/source";
import { createLogger } from "./lib/logging";
import { type GetEnv } from "./lib/routing";
import {
  HealthErrorResponse,
  HealthResponse,
  invalidRequestParameters,
} from "./models/api";
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
const productionServer = {
  url: "https://ratesapi.nz",
  description: "Production",
};
const openApiExclude = {
  paths: ["/api/v1/mcp", "/api/v1/mcp/"],
};
const openApiInfo = {
  version: "1.0.0",
  title: "Rates API",
  description:
    "Rates API is a free OpenAPI service to retrieve the latest lending rates offered by New Zealand financial institutions — updated hourly.",
};

type CreateAppOptions = {
  adapter?: ElysiaAdapter;
};

export function createApp(getEnv: GetEnv, options: CreateAppOptions = {}) {
  const apiRoutes = new Elysia({ prefix: "/api/v1" })
    .use(
      cors({
        origin: "*",
        credentials: false,
        maxAge: 600,
      }),
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
          const result = await getEnv()
            .RATESAPI_DB.prepare(
              "SELECT data_type, last_updated FROM latest_data ORDER BY data_type ASC",
            )
            .all();

          return {
            status: healthStatusOk,
            dataSets: result.results.flatMap((row) => {
              const dataType = row.data_type;
              const lastUpdated = row.last_updated;

              if (
                typeof dataType !== "string" ||
                typeof lastUpdated !== "string"
              ) {
                return [];
              }

              return [{ dataType, lastUpdated }];
            }),
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
          summary: "Get API data freshness",
        },
      },
    );

  const docsApp = createDocsApp();

  const app = new Elysia({
    name: "rates-api",
    adapter: options.adapter,
  })
    .use(
      openapi({
        documentation: {
          info: openApiInfo,
          servers: [productionServer],
        },
        exclude: openApiExclude,
      }),
    )
    .onBeforeHandle({ as: "global" }, ({ request, set }) => {
      set.headers["x-request-id"] =
        request.headers.get("x-request-id") ?? crypto.randomUUID();
    })
    .onError({ as: "global" }, ({ code, error, status }) => {
      if (code === "VALIDATION") {
        validationLog.warn({ error }, "Request validation failed");
        return status(400, invalidRequestParameters());
      }

      return undefined;
    })
    .use(apiRoutes)
    .get(
      "/openapi/json",
      ({ request }) => {
        const generatedSchema = toOpenAPISchema(app, openApiExclude);

        return {
          openapi: "3.0.3",
          info: openApiInfo,
          servers: getOpenApiServers(request, getEnv().ENVIRONMENT),
          paths: generatedSchema.paths,
          components: generatedSchema.components,
        };
      },
      {
        detail: {
          hide: true,
        },
      },
    )
    .get("/llms.txt", renderLlmsTxt)
    .get("/api/search", ({ request }) => renderDocsSearch(request), {
      detail: {
        hide: true,
      },
    })
    .use(docsApp);

  return app;
}

export type App = ReturnType<typeof createApp>;

function createDocsApp() {
  return docsRoutes.reduce(
    (routes, path) =>
      routes.get(path, () => {
        const docsResponse = renderDocsRoute(path);

        return docsResponse ?? new Response("Not found", { status: 404 });
      }),
    new Elysia(),
  );
}

function getOpenApiServers(request: Request, environment: string | undefined) {
  const origin = new URL(request.url).origin;
  const currentServer = {
    url: origin,
    description: environment === "production" ? "Production" : "Local",
  };

  if (origin === productionServer.url) {
    return [currentServer];
  }

  return [currentServer, productionServer];
}
