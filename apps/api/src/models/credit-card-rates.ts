import { t } from "elysia";
import { Issuer } from "./issuer";

export const CreditCardRates = t.Object(
  {
    type: t.Literal("CreditCardRates", {
      description: "The type of data. The value is always `CreditCardRates`.",
    }),
    data: t.Array(Issuer, {
      title: "CreditCardRates",
      description: "The issuers and their credit card plans.",
    }),
    lastUpdated: t.String({
      description:
        "The date and time (UTC, ISO 8601) when the API collected this data from the source.",
      examples: ["2021-08-01T00:00:00.000Z"],
    }),
  },
  { additionalProperties: false },
);

export type CreditCardRates = typeof CreditCardRates.static;
