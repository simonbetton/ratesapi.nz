import { z } from "@hono/zod-openapi";
import { toTitleFormat } from "../lib/transforms";
import { Institution as InstitutionSchema } from "./institution";
import { Product as ProductSchema } from "./product";
import { Rate as RateSchema, type RateId } from "./rate";

export const CarLoanRates = z
  .object({
    type: z.literal("CarLoanRates"),
    data: z
      .array(
        InstitutionSchema.extend({
          products: z.array(
            ProductSchema.extend({
              rates: z.array(
                RateSchema.extend({
                  plan: z
                    .string()
                    .transform(toTitleFormat)
                    .nullable()
                    .openapi({
                      examples: ["Secured"],
                    }),
                  condition: z
                    .string()
                    .transform(toTitleFormat)
                    .nullable()
                    .openapi({
                      examples: ["$3,000 to $50,000"],
                    }),
                }),
              ),
            }),
          ),
        }),
      )
      .openapi("CarLoanRates"),
    lastUpdated: z.string().openapi({
      example: "2021-08-01T00:00:00.000Z",
    }),
  })
  .strict();

export type Rate = z.infer<
  typeof CarLoanRates
>["data"][number]["products"][number]["rates"][number] & {
  id: RateId;
};

export type CarLoanRates = {
  data: (InstitutionSchema & {
    products: (ProductSchema & {
      rates: Rate[];
    })[];
  })[];
};
export type Institution = CarLoanRates["data"][number];
export type Product = CarLoanRates["data"][number]["products"][number];
