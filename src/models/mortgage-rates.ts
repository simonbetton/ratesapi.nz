import { z } from "@hono/zod-openapi";
import * as InstitutionModel from "./institution";
import * as ProductModel from "./product";
import * as RateModel from "./rate";

const RATE_TERMS = [
  "Variable floating",
  "6 months",
  "18 months",
  "1 year",
  "2 years",
  "3 years",
  "4 years",
  "5 years",
] satisfies readonly [
  "Variable floating",
  "6 months",
  "18 months",
  "1 year",
  "2 years",
  "3 years",
  "4 years",
  "5 years",
];

export type RateTerm = (typeof RATE_TERMS)[number];

const MortgageRatesSchema = z
  .object({
    type: z.literal("MortgageRates"),
    data: z
      .array(
        InstitutionModel.Institution.extend({
          products: z.array(
            ProductModel.Product.extend({
              rates: z.array(
                RateModel.Rate.extend({
                  term: z.enum(RATE_TERMS).openapi({
                    examples: ["6 months", "3 years"],
                  }),
                  termInMonths: z
                    .number()
                    .nullable()
                    .openapi({
                      examples: [6, 36],
                    }),
                }),
              ),
            }),
          ),
        }),
      )
      .openapi("MortgageRates"),
    lastUpdated: z.string().openapi({
      example: "2021-08-01T00:00:00.000Z",
    }),
  })
  .strict();

export const MortgageRates = MortgageRatesSchema;

// Why must this be external? 🤷
export type Rate = z.infer<
  typeof MortgageRatesSchema
>["data"][number]["products"][number]["rates"][number] & {
  id: RateModel.RateId;
};

export type MortgageRates = z.infer<typeof MortgageRatesSchema>;
export type Institution = MortgageRates["data"][number];
export type Product = MortgageRates["data"][number]["products"][number];

export function isRateTerm(term: string): term is RateTerm {
  return RATE_TERMS.some((candidate) => candidate === term);
}
