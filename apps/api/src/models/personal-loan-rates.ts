import { t } from "elysia";

import { nullable } from "../lib/schema";
import { RateSchema } from "./rate";

const PersonalLoanRate = t.Object(
  {
    ...RateSchema.properties,
    plan: nullable(
      t.String({
        examples: ["Secured"],
      }),
      {
        description:
          "The type of loan, for example, `Secured` or `Unsecured`. The value is `null` if the source does not give a type.",
      }
    ),
    condition: nullable(
      t.String({
        examples: ["$3,000 to $50,000"],
      }),
      {
        description:
          "A condition for the rate, for example, a loan amount or a loan term. The value is `null` if the rate has no condition.",
      }
    ),
  },
  { additionalProperties: false }
);

const PersonalLoanProduct = t.Object(
  {
    id: t.String({
      pattern: "^product:",
      description: "The ID of the personal loan product.",
      examples: ["product:asb:personal-loan"],
    }),
    name: t.String({
      description: "The name of the product that the institution uses.",
      examples: ["Personal Loan"],
    }),
    rates: t.Array(PersonalLoanRate, {
      description: "The rates for this product.",
    }),
  },
  { additionalProperties: false }
);

const PersonalLoanInstitution = t.Object(
  {
    id: t.String({
      pattern: "^institution:",
      description:
        "The ID of the institution. Use this value for the `institutionId` parameter.",
      examples: ["institution:asb"],
    }),
    name: t.String({
      description: "The name of the institution.",
      examples: ["ANZ", "Kiwibank", "Westpac"],
    }),
    products: t.Array(PersonalLoanProduct, {
      description: "The personal loan products of this institution.",
    }),
  },
  { additionalProperties: false }
);

export const PersonalLoanRates = t.Object(
  {
    type: t.Literal("PersonalLoanRates", {
      description: "The type of data. The value is always `PersonalLoanRates`.",
    }),
    data: t.Array(PersonalLoanInstitution, {
      title: "PersonalLoanRates",
      description: "The institutions and their personal loan rates.",
    }),
    lastUpdated: t.String({
      description:
        "The date and time (UTC, ISO 8601) when the API collected this data from the source.",
      examples: ["2021-08-01T00:00:00.000Z"],
    }),
  },
  { additionalProperties: false }
);

export type PersonalLoanRate = typeof PersonalLoanRate.static;
export type PersonalLoanRates = typeof PersonalLoanRates.static;
export type PersonalLoanInstitution = PersonalLoanRates["data"][number];
export type PersonalLoanProduct =
  PersonalLoanRates["data"][number]["products"][number];
