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
  term: z.nativeEnum(RateTerm).openapi({
    example: "3 years",
  }),
  rate: z.number().openapi({
    example: 4.29,
  }),
});
export type Rate = z.infer<typeof Rate>;

export const Product = z.object({
  name: z.string().openapi({
    example: "Standard",
  }),
  rates: z.array(Rate),
});
export type Product = z.infer<typeof Product>;

export const Institution = z.object({
  name: z.string().openapi({
    example: "ANZ",
  }),
  products: z.array(Product),
});
export type Institution = z.infer<typeof Institution>;

export const MortgageRates = z.array(Institution).openapi("MortgageRates");
export type MortgageRates = z.infer<typeof MortgageRates>;

export function isRateTerm(term: string): term is RateTerm {
  return Object.values(RateTerm).includes(term as RateTerm);
}

export const ParamsSchema = z.object({
  institution: z.string().openapi({
    param: {
      name: "institution",
      in: "path",
    },
    example: "anz",
  }),
});
