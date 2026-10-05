import { t } from "elysia";

import { nullable } from "../lib/schema";
import { RateSchema } from "./rate";

export type RateTerm =
  | "By agreement"
  | "Fixed for 3–18 months"
  | "Variable floating"
  | "6 months"
  | "18 months"
  | "1 year"
  | "2 years"
  | "3 years"
  | "4 years"
  | "5 years";

const RateTermValues: [RateTerm, ...RateTerm[]] = [
  "By agreement",
  "Fixed for 3–18 months",
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
  BY_AGREEMENT: "By agreement",
  FIXED_RANGE: "Fixed for 3–18 months",
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
    condition: t.Optional(
      t.String({
        description: "Eligibility or other conditions published with the rate.",
      })
    ),
    term: t.UnionEnum(RateTermValues, {
      description:
        "The term of the rate. `Variable floating` is a rate that the institution can change at any time. `By agreement` means the lender does not publish a single fixed period. Other values describe fixed periods.",
      examples: ["6 months", "3 years"],
    }),
    termInMonths: nullable(
      t.Number({
        examples: [6, 36],
      }),
      {
        description:
          "The fixed term in months. The value is `null` for a variable rate, a term agreed individually, or a fixed period range; consult `term`.",
      }
    ),
  },
  { additionalProperties: false }
);

const MortgageProduct = t.Object(
  {
    id: t.String({
      pattern: "^product:",
      description: "The ID of the mortgage product.",
      examples: ["product:anz:standard"],
    }),
    name: t.String({
      description: "The name of the product that the institution uses.",
      examples: ["Standard"],
    }),
    rates: t.Array(MortgageRate, {
      description:
        "The rates for this product. Each rate has a different term.",
    }),
  },
  { additionalProperties: false }
);

const MortgageInstitution = t.Object(
  {
    id: t.String({
      pattern: "^institution:",
      description:
        "The ID of the institution. Use this value for the `institutionId` parameter.",
      examples: ["institution:anz"],
    }),
    name: t.String({
      description: "The name of the institution.",
      examples: ["ANZ", "Kiwibank", "Westpac"],
    }),
    products: t.Array(MortgageProduct, {
      description: "The mortgage products of this institution.",
    }),
  },
  { additionalProperties: false }
);

export const MortgageRates = t.Object(
  {
    type: t.Literal("MortgageRates", {
      description: "The type of data. The value is always `MortgageRates`.",
    }),
    data: t.Array(MortgageInstitution, {
      title: "MortgageRates",
      description: "The institutions and their mortgage rates.",
    }),
    lastUpdated: t.String({
      description:
        "The date and time (UTC, ISO 8601) when the API collected this data from the source.",
      examples: ["2021-08-01T00:00:00.000Z"],
    }),
  },
  { additionalProperties: false }
);

export type MortgageRate = typeof MortgageRate.static;
export type MortgageRates = typeof MortgageRates.static;
export type MortgageInstitution = MortgageRates["data"][number];
export type MortgageProduct = MortgageRates["data"][number]["products"][number];

export function isRateTerm(term: string): term is RateTerm {
  return RateTermLookup.has(term);
}
