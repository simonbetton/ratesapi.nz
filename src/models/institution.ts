import { z } from "@hono/zod-openapi";
import { Product } from "./product";

export type InstitutionId = `institution:${string}`;

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
  id: InstitutionId;
  products: Product[];
};
