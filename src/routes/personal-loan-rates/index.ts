import { OpenAPIHono } from "@hono/zod-openapi";
import { type Bindings } from "hono/types";
import unValidatedPersonalLoanRates from "../../../data/personal-loan-rates.json";
import { PersonalLoanRates } from "../../models/personal-loan-rates";
import { termsOfUse } from "../../utils/terms-of-use";
import { getPersonalLoanRatesByInstitutionRoute } from "./getPersonalLoanRatesByInstitution";
import { listPersonalLoanRatesRoute } from "./listPersonalLoanRates";

const routes = new OpenAPIHono<{ Bindings: Bindings }>();

// Route: `GET /personal-loan-rates`
routes.openapi(listPersonalLoanRatesRoute, (c) => {
  const validatedPersonalLoanRates = PersonalLoanRates.parse(
    unValidatedPersonalLoanRates,
  );
  return c.json({
    ...validatedPersonalLoanRates,
    termsOfUse: termsOfUse(),
  });
});

// Route: `GET /personal-loan-rates/{institutionId}`
routes.openapi(getPersonalLoanRatesByInstitutionRoute, (c) => {
  const { institutionId } = c.req.valid("param");
  const validatedPersonalLoanRates = PersonalLoanRates.parse(
    unValidatedPersonalLoanRates,
  );
  const singleInstitution = validatedPersonalLoanRates.data.find(
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

  return c.json({
    ...validatedPersonalLoanRates,
    data: [singleInstitution],
    termsOfUse: termsOfUse(),
  });
});

export { routes };
