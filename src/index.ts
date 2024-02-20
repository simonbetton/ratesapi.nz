import { cache } from "hono/cache";
import { prettyJSON } from "hono/pretty-json";
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { type MortgageRates } from "./models/mortgage-rates";
import unvalidatedMortgageRates from "../data/mortgage-rates.json";
import { getMortgageRatesByInstitutionNameRoute } from "./routes/getMortgageRatesByInstitutionName";
import { getMortgageRatesRoute } from "./routes/getMortgageRates";

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

// Route: `GET /mortgage-rates`
app.openapi(getMortgageRatesRoute, (c) => {
  const { term } = c.req.valid("query");

  if (term) {
    return c.json(
      (unvalidatedMortgageRates as MortgageRates).map((institution) => ({
        name: institution.name,
        products: institution.products
          .map((product) => ({
            name: product.name,
            rates: product.rates.filter((rate) => rate.term === term),
          }))
          .filter((product) => product.rates.length > 0),
      }))
    );
  }

  return c.json(unvalidatedMortgageRates as MortgageRates);
});

// Route: `GET /mortgage-rates/{institution}`
app.openapi(getMortgageRatesByInstitutionNameRoute, (c) => {
  const { institution } = c.req.valid("param");
  return c.json(
    (unvalidatedMortgageRates as MortgageRates).filter(
      (mortgageRate) =>
        mortgageRate.name.toLowerCase() === institution.toLowerCase()
    )
  );
});

// OpenAPI documentation
// Route: `GET /doc`
app.doc31("/doc", {
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
  ],
});

// Swagger UI
app.get("/", swaggerUI({ url: "/doc" }));

export default app;
