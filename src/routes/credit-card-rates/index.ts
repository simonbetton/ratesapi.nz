import { OpenAPIHono } from "@hono/zod-openapi";
import { type Bindings } from "hono/types";
import unValidatedCreditCardRates from "../../../data/credit-card-rates.json";
import { termsOfUse } from "../../lib/terms-of-use";
import { getCurrentTimestamp } from "../../lib/transforms";
import { CreditCardRates } from "../../models/credit-card-rates";
import { getCreditCardRatesIssuerRoute } from "./getCreditCardRatesIssuer";
import { listCreditCardRatesRoute } from "./listCreditCardRates";

const routes = new OpenAPIHono<{ Bindings: Bindings }>();

// Route: `GET /credit-card-rates`
routes.openapi(listCreditCardRatesRoute, (c) => {
  const validatedCreditCardRates = CreditCardRates.parse(
    unValidatedCreditCardRates,
  );
  return c.json({
    ...validatedCreditCardRates,
    termsOfUse: termsOfUse(),
    timestamp: getCurrentTimestamp(),
  });
});

// Route: `GET /credit-card-rates/{issuerId}`
routes.openapi(getCreditCardRatesIssuerRoute, (c) => {
  const { issuerId } = c.req.valid("param");
  const validatedCreditCardRates = CreditCardRates.parse(
    unValidatedCreditCardRates,
  );
  const singleIssuer = validatedCreditCardRates.data.find(
    (i) => i.id.toLowerCase() === issuerId.toLowerCase(),
  );

  if (!singleIssuer) {
    return c.json(
      {
        code: 404,
        message: "Institution not found",
      },
      404,
    );
  }

  return c.json({
    ...validatedCreditCardRates,
    data: [singleIssuer],
    termsOfUse: termsOfUse(),
    timestamp: getCurrentTimestamp(),
  });
});

export { routes };
