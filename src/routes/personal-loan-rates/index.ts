import { OpenAPIHono } from "@hono/zod-openapi";
import { Bindings } from "hono/types";
import { getPersonalLoanRatesRoute } from "./getPersonalLoanRates";
import { getPersonalLoanRatesByInstitutionRoute } from "./getPersonalLoanRatesByInstitution";
import unValidatedPersonalLoanRates from "../../../data/personal-loan-rates.json";
import { PersonalLoanRates } from "../../models/personal-loan-rates";

const routes = new OpenAPIHono<{ Bindings: Bindings }>();

// Route: `GET /personal-loan-rates`
routes.openapi(getPersonalLoanRatesRoute, (c) => {
  const validatedPersonalLoanRates = PersonalLoanRates.parse(
    unValidatedPersonalLoanRates
  );
  const termsOfUse =
    "Data is retrieved hourly from interest.co.nz. Please note that the information provided is not guaranteed to be accurate. For the most up-to-date and accurate rates, please check with the provider directly.";

  return c.json({
    ...validatedPersonalLoanRates,
    termsOfUse,
  });
});

// Route: `GET /personal-loan-rates/{institution}`
routes.openapi(getPersonalLoanRatesByInstitutionRoute, (c) => {
  const { institution } = c.req.valid("param");

  const validatedPersonalLoanRates = PersonalLoanRates.parse(
    unValidatedPersonalLoanRates
  );
  const termsOfUse =
    "Data is retrieved hourly from interest.co.nz. Please note that the information provided is not guaranteed to be accurate. For the most up-to-date and accurate rates, please check with the provider directly.";

  const singleInstitution = validatedPersonalLoanRates.data.find(
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

  return c.json({
    ...validatedPersonalLoanRates,
    data: [singleInstitution],
    termsOfUse,
  });
});

export { routes };
