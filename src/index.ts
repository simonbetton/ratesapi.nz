import { cache } from "hono/cache";
import { cors } from "hono/cors";
import { prettyJSON } from "hono/pretty-json";
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { routes as mortgageRatesRoutes } from "./routes/mortgage-rates";
import { routes as personalLoanRatesRoutes } from "./routes/personal-loan-rates";

const app = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        {
          code: 500,
          message: "A server error occurred while processing the request",
        },
        500
      );
    }
  },
});

app.use(
  "*",
  prettyJSON(),
  cache({ cacheName: "rates-api", cacheControl: "public, max-age=3600" })
);

app.use(
  "/api/v1/*",
  cors({
    origin: "*",
    maxAge: 600,
  })
);

app.route("/api/v1/mortgage-rates", mortgageRatesRoutes);
app.route("/api/v1/personal-loan-rates", personalLoanRatesRoutes);

// OpenAPI documentation
// Route: `GET /api/v1/doc`
app.doc31("/api/v1/doc", {
  openapi: "3.1.0",
  info: {
    version: "1.0.0",
    title: "Rates API",
    description:
      "Rates API is a free OpenAPI service to retrieve the latest lending rates offered by New Zealand financial institutions — updated hourly.",
  },
  servers: [
    {
      url: "https://ratesapi.nz",
      description: "Production",
    },
    {
      url: "http://localhost:8787",
      description: "Local",
    },
  ],
});

// Swagger UI
app.get("/", swaggerUI({ url: "/api/v1/doc" }));

export default app;
