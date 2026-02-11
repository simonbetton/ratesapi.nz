import { z } from "@hono/zod-openapi";
import { Issuer } from "./issuer";

const CreditCardRatesSchema = z
  .object({
    type: z.literal("CreditCardRates"),
    data: z.array(Issuer).openapi("CarLoanRates"),
    lastUpdated: z.string().openapi({
      example: "2021-08-01T00:00:00.000Z",
    }),
  })
  .strict();

export const CreditCardRates = CreditCardRatesSchema;

export type CreditCardRates = z.infer<typeof CreditCardRatesSchema>;
