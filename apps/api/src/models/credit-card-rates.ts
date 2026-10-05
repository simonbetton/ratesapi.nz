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
        "The collection timestamp (UTC, ISO 8601) for this snapshot. A partial update keeps the previous timestamp because some institutions could not be collected again.",
      examples: ["2021-08-01T00:00:00.000Z"],
    }),
  },
  { additionalProperties: false }
);

export type CreditCardRates = typeof CreditCardRates.static;
