import { z } from "@hono/zod-openapi";

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

export const Rate = z.object({
  id: z.string().openapi({
    examples: ["rate:anz:standard:18-months"],
  }),
  term: z.nativeEnum(RateTerm).openapi({
    examples: ["6 months", "3 years"],
  }),
  termInMonths: z
    .number()
    .nullable()
    .openapi({
      examples: [6, 36],
    }),
  rate: z.number().openapi({
    examples: [4.29],
  }),
});
export type Rate = z.infer<typeof Rate>;

export const Product = z.object({
  id: z.string().openapi({
    examples: ["product:anz:standard"],
  }),
  name: z.string().openapi({
    examples: ["Standard"],
  }),
  rates: z.array(Rate),
});
export type Product = z.infer<typeof Product>;

export const Institution = z.object({
  id: z.string().openapi({
    examples: ["institution:anz"],
  }),
  name: z.string().openapi({
    examples: ["ANZ", "Kiwibank", "Westpac"],
  }),
  products: z.array(Product),
});
export type Institution = z.infer<typeof Institution>;

export const MortgageRates = z
  .object({
    type: z.literal("MortgageRates"),
    data: z.array(Institution).openapi("MortgageRates"),
    lastUpdated: z.string().openapi({
      example: "2021-08-01T00:00:00.000Z",
    }),
  })
  .strict();
export type MortgageRates = z.infer<typeof MortgageRates>;

export function isRateTerm(term: string): term is RateTerm {
  return Object.values(RateTerm).includes(term as RateTerm);
}
