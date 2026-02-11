import { z } from "@hono/zod-openapi";
import { toTitleFormat } from "../lib/transforms";
import * as InstitutionModel from "./institution";
import * as ProductModel from "./product";
import * as RateModel from "./rate";

const CarLoanRatesSchema = z
  .object({
    type: z.literal("CarLoanRates"),
    data: z
      .array(
        InstitutionModel.Institution.extend({
          products: z.array(
            ProductModel.Product.extend({
              rates: z.array(
                RateModel.Rate.extend({
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

export const CarLoanRates = CarLoanRatesSchema;

export type Rate = z.infer<
  typeof CarLoanRatesSchema
>["data"][number]["products"][number]["rates"][number] & {
  id: RateModel.RateId;
};

export type CarLoanRates = z.infer<typeof CarLoanRatesSchema>;
export type Institution = CarLoanRates["data"][number];
export type Product = CarLoanRates["data"][number]["products"][number];
