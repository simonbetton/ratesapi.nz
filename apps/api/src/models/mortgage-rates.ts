import { t } from "elysia";
import { RateSchema } from "./rate";

export type RateTerm =
  | "Variable floating"
  | "6 months"
  | "18 months"
  | "1 year"
  | "2 years"
  | "3 years"
  | "4 years"
  | "5 years";

const RateTermValues: [RateTerm, ...RateTerm[]] = [
  "Variable floating",
  "6 months",
  "18 months",
  "1 year",
  "2 years",
  "3 years",
  "4 years",
  "5 years",
];

export const RateTerm: Record<string, RateTerm> = {
  VARIABLE_FLOATING: "Variable floating",
  "6_MONTHS": "6 months",
  "18_MONTHS": "18 months",
  "1_YEAR": "1 year",
  "2_YEARS": "2 years",
  "3_YEARS": "3 years",
  "4_YEARS": "4 years",
  "5_YEARS": "5 years",
};

const RateTermLookup = new Set<string>(RateTermValues);

const MortgageRate = t.Object(
  {
    ...RateSchema.properties,
    term: t.UnionEnum(RateTermValues, {
      examples: ["6 months", "3 years"],
    }),
    termInMonths: t.Nullable(
      t.Number({
        examples: [6, 36],
      }),
    ),
  },
  { additionalProperties: false },
);

const MortgageProduct = t.Object(
  {
    id: t.String({
      pattern: "^product:",
      examples: ["product:anz:standard"],
    }),
    name: t.String({
      examples: ["Standard"],
    }),
    rates: t.Array(MortgageRate),
  },
  { additionalProperties: false },
);

const MortgageInstitution = t.Object(
  {
    id: t.String({
      pattern: "^institution:",
      examples: ["institution:anz"],
    }),
    name: t.String({
      examples: ["ANZ", "Kiwibank", "Westpac"],
    }),
    products: t.Array(MortgageProduct),
  },
  { additionalProperties: false },
);

export const MortgageRates = t.Object(
  {
    type: t.Literal("MortgageRates"),
    data: t.Array(MortgageInstitution, {
      title: "MortgageRates",
    }),
    lastUpdated: t.String({
      example: "2021-08-01T00:00:00.000Z",
    }),
  },
  { additionalProperties: false },
);

export type MortgageRate = typeof MortgageRate.static;
export type MortgageRates = typeof MortgageRates.static;
export type MortgageInstitution = MortgageRates["data"][number];
export type MortgageProduct = MortgageRates["data"][number]["products"][number];

export function isRateTerm(term: string): term is RateTerm {
  return RateTermLookup.has(term);
}
