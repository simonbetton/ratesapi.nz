import { z } from "@hono/zod-openapi";
import { toTitleFormat } from "../lib/transforms";
import { Rate } from "./rate";

export type ProductId = `product:${string}`;

export const Product = z
  .object({
    id: z
      .string()
      .regex(/^product:/, "String must start with 'product:'")
      .openapi({
        examples: ["product:anz:standard"],
      }),
    name: z
      .string()
      .transform(toTitleFormat)
      .openapi({
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
  id: ProductId;
};
