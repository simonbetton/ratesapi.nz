import { t } from "elysia";
import { Issuer } from "./issuer";

export const CreditCardRates = t.Object(
  {
    type: t.Literal("CreditCardRates"),
    data: t.Array(Issuer, {
      title: "CreditCardRates",
    }),
    lastUpdated: t.String({
      example: "2021-08-01T00:00:00.000Z",
    }),
  },
  { additionalProperties: false },
);

export type CreditCardRates = typeof CreditCardRates.static;
