import { z } from "@hono/zod-openapi";
import { Rate, RateId } from "./rate";
import { Institution } from "./institution";
import { Product } from "./product";

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
        Institution.extend({
          products: z.array(
            Product.extend({
              rates: z.array(
                Rate.extend({
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

type ExtendedRate = z.infer<
  typeof MortgageRates
>["data"][number]["products"][number]["rates"][number] & {
  id: RateId;
};

export type MortgageRates = {
  data: (Institution & {
    products: (Product & {
      rates: ExtendedRate[];
    })[];
  })[];
};

export function isRateTerm(term: string): term is RateTerm {
  return Object.values(RateTerm).includes(term as RateTerm);
}
