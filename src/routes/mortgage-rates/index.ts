import { OpenAPIHono } from "@hono/zod-openapi";
import { Bindings } from "hono/types";
import { getMortgageRatesRoute } from "./getMortgageRates";
import { getMortgageRatesByInstitutionRoute } from "./getMortgageRatesByInstitution";
import unValidatedMortgageRates from "../../../data/mortgage-rates.json";
import { MortgageRates } from "../../models/mortgage-rates";

const routes = new OpenAPIHono<{ Bindings: Bindings }>();

// Route: `GET /mortgage-rates`
routes.openapi(getMortgageRatesRoute, (c) => {
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

// Route: `GET /mortgage-rates/{institutionId}`
routes.openapi(getMortgageRatesByInstitutionRoute, (c) => {
  const { institutionId } = c.req.valid("param");
  const { termInMonths } = c.req.valid("query");

  const validatedMortgageRates = MortgageRates.parse(unValidatedMortgageRates);
  const termsOfUse =
    "Data is retrieved hourly from interest.co.nz. Please note that the information provided is not guaranteed to be accurate. For the most up-to-date and accurate rates, please check with the provider directly.";

  const singleInstitution = validatedMortgageRates.data.find(
    (i) => i.id.toLowerCase() === institutionId.toLowerCase()
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

export { routes };
