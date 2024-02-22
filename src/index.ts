import { cache } from "hono/cache";
import { cors } from "hono/cors";
import { prettyJSON } from "hono/pretty-json";
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { MortgageRates } from "./models/mortgage-rates";
import unValidatedMortgageRates from "../data/mortgage-rates.json";
import { getMortgageRatesByInstitutionRoute } from "./routes/getMortgageRatesByInstitution";
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

app.use(
  "/api/v1/*",
  cors({
    origin: "*",
    maxAge: 600,
  })
);

// Route: `GET /api/v1/mortgage-rates`
app.openapi(getMortgageRatesRoute, (c) => {
  const { termInMonths } = c.req.valid("query");

  const validatedMortgageRates = MortgageRates.parse(unValidatedMortgageRates);
  const termsOfUse =
    "Data is retrieved hourly from interest.co.nz. Please note that the information provided is not guaranteed to be accurate. For the most up-to-date and accurate rates, please check with the provider directly.";

  if (termInMonths) {
    const filteredMortgageRates = validatedMortgageRates.data.map(
      (institution) => ({
        ...institution,
        products: institution.products
          .map((product) => ({
            ...product,
            rates: product.rates.filter(
              (rate) => rate.termInMonths === parseInt(termInMonths)
            ),
          }))
          .filter((product) => product.rates.length > 0),
      })
    );

    return c.json({
      ...validatedMortgageRates,
      data: filteredMortgageRates,
      termsOfUse,
    });
  }

  return c.json({
    ...validatedMortgageRates,
    termsOfUse,
  });
});

// Route: `GET /api/v1/mortgage-rates/{institution}`
app.openapi(getMortgageRatesByInstitutionRoute, (c) => {
  const { institution } = c.req.valid("param");
  const { termInMonths } = c.req.valid("query");

  const validatedMortgageRates = MortgageRates.parse(unValidatedMortgageRates);
  const termsOfUse =
    "Data is retrieved hourly from interest.co.nz. Please note that the information provided is not guaranteed to be accurate. For the most up-to-date and accurate rates, please check with the provider directly.";

  const singleInstitution = validatedMortgageRates.data.find(
    (i) => i.name.toLowerCase() === institution.toLowerCase()
  );

  if (!singleInstitution) {
    return c.json(
      {
        code: 404,
        message: "Institution not found",
      },
      404
    );
  }

  if (termInMonths) {
    const filteredProducts = singleInstitution.products
      .map((product) => ({
        ...product,
        rates: product.rates.filter(
          (rate) => rate.termInMonths === parseInt(termInMonths)
        ),
      }))
      .filter((product) => product.rates.length > 0);

    return c.json({
      ...validatedMortgageRates,
      data: [
        {
          ...singleInstitution,
          products: filteredProducts,
        },
      ],
      termsOfUse,
    });
  }

  return c.json({
    ...validatedMortgageRates,
    data: [singleInstitution],
    termsOfUse,
  });
});

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
