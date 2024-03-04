import { z } from "@hono/zod-openapi";
import { Institution as InstitutionSchema } from "./institution";
import { Product as ProductSchema } from "./product";
import { type RateId, Rate as RateSchema } from "./rate";

export const PersonalLoanRates = z
  .object({
    type: z.literal("PersonalLoanRates"),
    data: z
      .array(
        InstitutionSchema.extend({
          products: z.array(
            ProductSchema.extend({
              rates: z.array(
                RateSchema.extend({
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

export type Rate = z.infer<
  typeof PersonalLoanRates
>["data"][number]["products"][number]["rates"][number] & {
  id: RateId;
};

export type PersonalLoanRates = {
  data: (InstitutionSchema & {
    products: (ProductSchema & {
      rates: Rate[];
    })[];
  })[];
};
export type Institution = PersonalLoanRates["data"][number];
export type Product = PersonalLoanRates["data"][number]["products"][number];
