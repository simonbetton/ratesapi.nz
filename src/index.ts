import { cache } from "hono/cache";
import { prettyJSON } from "hono/pretty-json";
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
app.doc("/doc", {
  openapi: "3.1.0",
  info: {
    version: "1.0.0",
    title: "Rates API",
  },
});

export default app;
