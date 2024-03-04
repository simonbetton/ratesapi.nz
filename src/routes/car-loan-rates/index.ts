import { OpenAPIHono } from "@hono/zod-openapi";
import { type Bindings } from "hono/types";
import unValidatedCarLoanRates from "../../../data/car-loan-rates.json";
import { CarLoanRates } from "../../models/car-loan-rates";
import { termsOfUse } from "../../utils/terms-of-use";
import { getCarLoanRatesByInstitutionRoute } from "./getCarLoanRatesByInstitution";
import { listCarLoanRatesRoute } from "./listCarLoanRates";

const routes = new OpenAPIHono<{ Bindings: Bindings }>();

// Route: `GET /car-loan-rates`
routes.openapi(listCarLoanRatesRoute, (c) => {
  const validatedCarLoanRates = CarLoanRates.parse(unValidatedCarLoanRates);
  return c.json({
    ...validatedCarLoanRates,
    termsOfUse: termsOfUse(),
  });
});

// Route: `GET /car-loan-rates/{institutionId}`
routes.openapi(getCarLoanRatesByInstitutionRoute, (c) => {
  const { institutionId } = c.req.valid("param");
  const validatedCarLoanRates = CarLoanRates.parse(unValidatedCarLoanRates);
  const singleInstitution = validatedCarLoanRates.data.find(
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
    ...validatedCarLoanRates,
    data: [singleInstitution],
    termsOfUse: termsOfUse(),
  });
});

export { routes };
