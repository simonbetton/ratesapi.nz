import { OpenAPIHono } from "@hono/zod-openapi";
import { type Bindings } from "hono/types";
import unValidatedMortgageRates from "../../../data/mortgage-rates.json";
import { MortgageRates } from "../../models/mortgage-rates";
import { termsOfUse } from "../../utils/terms-of-use";
import { getMortgageRatesByInstitutionRoute } from "./getMortgageRatesByInstitution";
import { listMortgageRatesRoute } from "./listMortgageRates";

const routes = new OpenAPIHono<{ Bindings: Bindings }>();

// Route: `GET /mortgage-rates`
routes.openapi(listMortgageRatesRoute, (c) => {
  const { termInMonths } = c.req.valid("query");
  const validatedMortgageRates = MortgageRates.parse(unValidatedMortgageRates);

  if (termInMonths) {
    const filteredMortgageRates = validatedMortgageRates.data.map(
      (institution) => ({
        ...institution,
        products: institution.products
          .map((product) => ({
            ...product,
            rates: product.rates.filter(
              (rate) => rate.termInMonths === parseInt(termInMonths),
            ),
          }))
          .filter((product) => product.rates.length > 0),
      }),
    );

    return c.json({
      ...validatedMortgageRates,
      data: filteredMortgageRates,
      termsOfUse: termsOfUse(),
    });
  }

  return c.json({
    ...validatedMortgageRates,
    termsOfUse: termsOfUse(),
  });
});

// Route: `GET /mortgage-rates/{institutionId}`
routes.openapi(getMortgageRatesByInstitutionRoute, (c) => {
  const { institutionId } = c.req.valid("param");
  const { termInMonths } = c.req.valid("query");
  const validatedMortgageRates = MortgageRates.parse(unValidatedMortgageRates);
  const singleInstitution = validatedMortgageRates.data.find(
    (i) => i.id.toLowerCase() === institutionId.toLowerCase(),
  );

  if (!singleInstitution) {
    return c.json(
      {
        code: 404,
        message: "Institution not found",
      },
      404,
    );
  }

  if (termInMonths) {
    const filteredProducts = singleInstitution.products
      .map((product) => ({
        ...product,
        rates: product.rates.filter(
          (rate) => rate.termInMonths === parseInt(termInMonths),
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
      termsOfUse: termsOfUse(),
    });
  }

  return c.json({
    ...validatedMortgageRates,
    data: [singleInstitution],
    termsOfUse: termsOfUse(),
  });
});

export { routes };
