import { t } from "elysia";
import { nullable } from "../lib/schema";
import { RateSchema } from "./rate";

const CarLoanRate = t.Object(
  {
    ...RateSchema.properties,
    plan: nullable(
      t.String({
        examples: ["Secured"],
      }),
      {
        description:
          "The type of loan, for example, `Secured` or `Unsecured`. The value is `null` if the source does not give a type.",
      },
    ),
    condition: nullable(
      t.String({
        examples: ["$3,000 to $50,000"],
      }),
      {
        description:
          "A condition for the rate, for example, a loan amount or a loan term. The value is `null` if the rate has no condition.",
      },
    ),
  },
  { additionalProperties: false },
);

const CarLoanProduct = t.Object(
  {
    id: t.String({
      pattern: "^product:",
      description: "The ID of the car loan product.",
      examples: ["product:asb:car-loan"],
    }),
    name: t.String({
      description: "The name of the product that the institution uses.",
      examples: ["Car Loan"],
    }),
    rates: t.Array(CarLoanRate, {
      description: "The rates for this product.",
    }),
  },
  { additionalProperties: false },
);

const CarLoanInstitution = t.Object(
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
    products: t.Array(CarLoanProduct, {
      description: "The car loan products of this institution.",
    }),
  },
  { additionalProperties: false },
);

export const CarLoanRates = t.Object(
  {
    type: t.Literal("CarLoanRates", {
      description: "The type of data. The value is always `CarLoanRates`.",
    }),
    data: t.Array(CarLoanInstitution, {
      title: "CarLoanRates",
      description: "The institutions and their car loan rates.",
    }),
    lastUpdated: t.String({
      description:
        "The date and time (UTC, ISO 8601) when the API collected this data from the source.",
      examples: ["2021-08-01T00:00:00.000Z"],
    }),
  },
  { additionalProperties: false },
);

export type CarLoanRate = typeof CarLoanRate.static;
export type CarLoanRates = typeof CarLoanRates.static;
export type CarLoanInstitution = CarLoanRates["data"][number];
export type CarLoanProduct = CarLoanRates["data"][number]["products"][number];
