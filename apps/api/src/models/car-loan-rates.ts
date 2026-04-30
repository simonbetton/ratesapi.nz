import { t } from "elysia";
import { RateSchema } from "./rate";

const CarLoanRate = t.Object(
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

const CarLoanProduct = t.Object(
  {
    id: t.String({
      pattern: "^product:",
      examples: ["product:asb:car-loan"],
    }),
    name: t.String({
      examples: ["Car Loan"],
    }),
    rates: t.Array(CarLoanRate),
  },
  { additionalProperties: false },
);

const CarLoanInstitution = t.Object(
  {
    id: t.String({
      pattern: "^institution:",
      examples: ["institution:asb"],
    }),
    name: t.String({
      examples: ["ANZ", "Kiwibank", "Westpac"],
    }),
    products: t.Array(CarLoanProduct),
  },
  { additionalProperties: false },
);

export const CarLoanRates = t.Object(
  {
    type: t.Literal("CarLoanRates"),
    data: t.Array(CarLoanInstitution, {
      title: "CarLoanRates",
    }),
    lastUpdated: t.String({
      example: "2021-08-01T00:00:00.000Z",
    }),
  },
  { additionalProperties: false },
);

export type Rate = typeof CarLoanRate.static;

export type CarLoanRates = typeof CarLoanRates.static;
export type Institution = CarLoanRates["data"][number];
export type Product = CarLoanRates["data"][number]["products"][number];
