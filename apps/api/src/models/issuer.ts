import { t } from "elysia";

import { Plan } from "./plan";

export const Issuer = t.Object(
  {
    id: t.String({
      pattern: "^issuer:",
      description:
        "The ID of the credit card issuer. Use this value for the `issuerId` parameter.",
      examples: ["issuer:anz"],
    }),
    name: t.String({
      description: "The name of the issuer.",
      examples: ["Amex", "Gem"],
    }),
    plans: t.Array(Plan, {
      description: "The credit card plans of this issuer.",
    }),
  },
  { additionalProperties: false }
);

export type Issuer = typeof Issuer.static;
