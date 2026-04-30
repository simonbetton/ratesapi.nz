import { t } from "elysia";
import { Plan } from "./plan";

export const Issuer = t.Object(
  {
    id: t.String({
      pattern: "^issuer:",
      examples: ["issuer:anz"],
    }),
    name: t.String({
      examples: ["Amex", "Gem"],
    }),
    plans: t.Array(Plan),
  },
  { additionalProperties: false },
);

export type Issuer = typeof Issuer.static;
