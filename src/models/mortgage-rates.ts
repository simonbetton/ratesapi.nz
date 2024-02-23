import { z } from "@hono/zod-openapi";
import { Rate as RateSchema, RateId } from "./rate";
import { Institution as InstitutionSchema } from "./institution";
import { Product as ProductSchema } from "./product";

export const RateTerm = {
  VARIABLE_FLOATING: "Variable floating",
  "6_MONTHS": "6 months",
  "18_MONTHS": "18 months",
  "1_YEAR": "1 year",
  "2_YEARS": "2 years",
  "3_YEARS": "3 years",
  "4_YEARS": "4 years",
  "5_YEARS": "5 years",
} as const;
export type RateTerm = (typeof RateTerm)[keyof typeof RateTerm];

export const MortgageRates = z
  .object({
    type: z.literal("MortgageRates"),
    data: z
      .array(
        InstitutionSchema.extend({
          products: z.array(
            ProductSchema.extend({
              rates: z.array(
                RateSchema.extend({
                  term: z.nativeEnum(RateTerm).openapi({
                    examples: ["6 months", "3 years"],
                  }),
                  termInMonths: z
                    .number()
                    .nullable()
                    .openapi({
                      examples: [6, 36],
                    }),
                })
              ),
            })
          ),
        })
      )
      .openapi("MortgageRates"),
    lastUpdated: z.string().openapi({
      example: "2021-08-01T00:00:00.000Z",
    }),
  })
  .strict();

// Why must this be external? 🤷
export type Rate = z.infer<
  typeof MortgageRates
>["data"][number]["products"][number]["rates"][number] & {
  id: RateId;
};

export type MortgageRates = {
  data: (InstitutionSchema & {
    products: (ProductSchema & {
      rates: Rate[];
    })[];
  })[];
};
export type Institution = MortgageRates["data"][number];
export type Product = MortgageRates["data"][number]["products"][number];

export function isRateTerm(term: string): term is RateTerm {
  return Object.values(RateTerm).includes(term as RateTerm);
}
