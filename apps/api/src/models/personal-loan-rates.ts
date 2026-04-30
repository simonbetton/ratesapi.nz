import { t } from "elysia";
import { RateSchema } from "./rate";

const PersonalLoanRate = t.Object(
  {
    ...RateSchema.properties,
    plan: t.Nullable(
      t.String({
        examples: ["Secured"],
      }),
    ),
    condition: t.Nullable(
      t.String({
        examples: ["$3,000 to $50,000"],
      }),
    ),
  },
  { additionalProperties: false },
);

const PersonalLoanProduct = t.Object(
  {
    id: t.String({
      pattern: "^product:",
      examples: ["product:asb:personal-loan"],
    }),
    name: t.String({
      examples: ["Personal Loan"],
    }),
    rates: t.Array(PersonalLoanRate),
  },
  { additionalProperties: false },
);

const PersonalLoanInstitution = t.Object(
  {
    id: t.String({
      pattern: "^institution:",
      examples: ["institution:asb"],
    }),
    name: t.String({
      examples: ["ANZ", "Kiwibank", "Westpac"],
    }),
    products: t.Array(PersonalLoanProduct),
  },
  { additionalProperties: false },
);

export const PersonalLoanRates = t.Object(
  {
    type: t.Literal("PersonalLoanRates"),
    data: t.Array(PersonalLoanInstitution, {
      title: "PersonalLoanRates",
    }),
    lastUpdated: t.String({
      example: "2021-08-01T00:00:00.000Z",
    }),
  },
  { additionalProperties: false },
);

export type Rate = typeof PersonalLoanRate.static;

export type PersonalLoanRates = typeof PersonalLoanRates.static;
export type Institution = PersonalLoanRates["data"][number];
export type Product = PersonalLoanRates["data"][number]["products"][number];
