import { z } from "@hono/zod-openapi";

export const Rate = z
  .object({
    id: z
      .string()
      .regex(/^rate:/, "String must start with 'rate:'")
      .openapi({
        examples: ["rate:anz:personal-loan:secured:from"],
      }),
    plan: z // TODO: Create an enum for the plan
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
        examples: ["product:anz:personal-loan"],
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

export const PersonalLoanRates = z
  .object({
    type: z.literal("PersonalLoanRates"),
    data: z.array(Institution).openapi("PersonalLoanRates"),
    lastUpdated: z.string().openapi({
      example: "2021-08-01T00:00:00.000Z",
    }),
  })
  .strict();
// The inferred type from a Zod schema using .regex() for string patterns
// would result in a generic string type when inferred.
// To enforce the pattern and have a specific type for the id,
// we intersect the inferred type with a literal type.
export type PersonalLoanRates = z.infer<typeof PersonalLoanRates> & {
  data: Institution[];
};
