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

export const Rate = z
  .object({
    id: z
      .string()
      .regex(/^rate:/, "String must start with 'rate:'")
      .openapi({
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
  })
  .strict();
// The inferred type from a Zod schema using .regex() for string patterns
// would result in a generic string type when inferred.
// To enforce the pattern and have a specific type for the id,
// we intersect the inferred type with a literal type.
export type Rate = z.infer<typeof Rate> & {
  id: `rate:${string}`;
};

export const Product = z
  .object({
    id: z
      .string()
      .regex(/^product:/, "String must start with 'product:'")
      .openapi({
        examples: ["product:anz:standard"],
      }),
    name: z.string().openapi({
      examples: ["Standard"],
    }),
    rates: z.array(Rate),
  })
  .strict();
// The inferred type from a Zod schema using .regex() for string patterns
// would result in a generic string type when inferred.
// To enforce the pattern and have a specific type for the id,
// we intersect the inferred type with a literal type.
export type Product = z.infer<typeof Product> & {
  id: `product:${string}`;
  rates: Rate[];
};

export const Institution = z
  .object({
    id: z
      .string()
      .regex(/^institution:/, "String must start with 'institution:'")
      .openapi({
        examples: ["institution:anz"],
      }),
    name: z.string().openapi({
      examples: ["ANZ", "Kiwibank", "Westpac"],
    }),
    products: z.array(Product),
  })
  .strict();
// The inferred type from a Zod schema using .regex() for string patterns
// would result in a generic string type when inferred.
// To enforce the pattern and have a specific type for the id,
// we intersect the inferred type with a literal type.
export type Institution = z.infer<typeof Institution> & {
  id: `institution:${string}`;
  products: Product[];
};

export const MortgageRates = z
  .object({
    type: z.literal("MortgageRates"),
    data: z.array(Institution).openapi("MortgageRates"),
    lastUpdated: z.string().openapi({
      example: "2021-08-01T00:00:00.000Z",
    }),
  })
  .strict();
// The inferred type from a Zod schema using .regex() for string patterns
// would result in a generic string type when inferred.
// To enforce the pattern and have a specific type for the id,
// we intersect the inferred type with a literal type.
export type MortgageRates = z.infer<typeof MortgageRates> & {
  data: Institution[];
};

export function isRateTerm(term: string): term is RateTerm {
  return Object.values(RateTerm).includes(term as RateTerm);
}
