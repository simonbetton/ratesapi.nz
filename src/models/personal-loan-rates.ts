import { z } from "@hono/zod-openapi";
import * as InstitutionModel from "./institution";
import * as ProductModel from "./product";
import * as RateModel from "./rate";

const PersonalLoanRatesSchema = z
  .object({
    type: z.literal("PersonalLoanRates"),
    data: z
      .array(
        InstitutionModel.Institution.extend({
          products: z.array(
            ProductModel.Product.extend({
              rates: z.array(
                RateModel.Rate.extend({
                  plan: z
                    .string()
                    .nullable()
                    .openapi({
                      examples: ["Secured"],
                    }),
                  condition: z
                    .string()
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
      .openapi("PersonalLoanRates"),
    lastUpdated: z.string().openapi({
      example: "2021-08-01T00:00:00.000Z",
    }),
  })
  .strict();

export const PersonalLoanRates = PersonalLoanRatesSchema;

export type Rate = z.infer<
  typeof PersonalLoanRatesSchema
>["data"][number]["products"][number]["rates"][number] & {
  id: RateModel.RateId;
};

export type PersonalLoanRates = z.infer<typeof PersonalLoanRatesSchema>;
export type Institution = PersonalLoanRates["data"][number];
export type Product = PersonalLoanRates["data"][number]["products"][number];
