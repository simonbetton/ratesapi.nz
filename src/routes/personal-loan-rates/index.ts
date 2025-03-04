import { OpenAPIHono } from "@hono/zod-openapi";
import { type Bindings } from "hono/types";
import unValidatedPersonalLoanRates from "../../../data/personal-loan-rates.json";
import { termsOfUse } from "../../lib/terms-of-use";
import { getCurrentTimestamp } from "../../lib/transforms";
import { PersonalLoanRates } from "../../models/personal-loan-rates";
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
    timestamp: getCurrentTimestamp(),
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
    timestamp: getCurrentTimestamp(),
  });
});

export { routes };
