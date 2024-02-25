import { z } from "@hono/zod-openapi";
import { Plan } from "./plan";

export type IssuerId = `issuer:${string}`;

export const Issuer = z
  .object({
    id: z
      .string()
      .regex(/^issuer:/, "String must start with 'issuer:'")
      .openapi({
        examples: ["issuer:anz"],
      }),
    name: z.string().openapi({
      examples: ["Amex", "Gem"],
    }),
    plans: z.array(Plan),
  })
  .strict();
// The inferred type from a Zod schema using .regex() for string patterns
// would result in a generic string type when inferred.
// To enforce the pattern and have a specific type for the id,
// we intersect the inferred type with a literal type.
export type Issuer = z.infer<typeof Issuer> & {
  id: IssuerId;
  plans: Plan[];
};
