import { z } from "@hono/zod-openapi";
import { Institution } from "./institution";
import { Product } from "./product";
import { Rate, RateId } from "./rate";

export const PersonalLoanRates = z
  .object({
    type: z.literal("PersonalLoanRates"),
    data: z
      .array(
        Institution.extend({
          products: z.array(
            Product.extend({
              rates: z.array(
                Rate.extend({
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
                })
              ),
            })
          ),
        })
      )
      .openapi("PersonalLoanRates"),
    lastUpdated: z.string().openapi({
      example: "2021-08-01T00:00:00.000Z",
    }),
  })
  .strict();

type ExtendedRate = z.infer<
  typeof PersonalLoanRates
>["data"][number]["products"][number]["rates"][number] & {
  id: RateId;
};

export type PersonalLoanRates = {
  data: (Institution & {
    products: (Product & {
      rates: ExtendedRate[];
    })[];
  })[];
};
