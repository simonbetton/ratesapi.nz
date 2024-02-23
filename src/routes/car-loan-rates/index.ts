import { OpenAPIHono } from "@hono/zod-openapi";
import { Bindings } from "hono/types";
import { getCarLoanRatesRoute } from "./getCarLoanRates";
import { getCarLoanRatesByInstitutionRoute } from "./getCarLoanRatesByInstitution";
import unValidatedCarLoanRates from "../../../data/car-loan-rates.json";
import { CarLoanRates } from "../../models/car-loan-rates";

const routes = new OpenAPIHono<{ Bindings: Bindings }>();

// Route: `GET /car-loan-rates`
routes.openapi(getCarLoanRatesRoute, (c) => {
  const validatedCarLoanRates = CarLoanRates.parse(unValidatedCarLoanRates);
  const termsOfUse =
    "Data is retrieved hourly from interest.co.nz. Please note that the information provided is not guaranteed to be accurate. For the most up-to-date and accurate rates, please check with the provider directly.";

  return c.json({
    ...validatedCarLoanRates,
    termsOfUse,
  });
});

// Route: `GET /car-loan-rates/{institutionId}`
routes.openapi(getCarLoanRatesByInstitutionRoute, (c) => {
  const { institutionId } = c.req.valid("param");

  const validatedCarLoanRates = CarLoanRates.parse(unValidatedCarLoanRates);
  const termsOfUse =
    "Data is retrieved hourly from interest.co.nz. Please note that the information provided is not guaranteed to be accurate. For the most up-to-date and accurate rates, please check with the provider directly.";

  const singleInstitution = validatedCarLoanRates.data.find(
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

  return c.json({
    ...validatedCarLoanRates,
    data: [singleInstitution],
    termsOfUse,
  });
});

export { routes };
