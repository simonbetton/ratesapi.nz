import { z } from "@hono/zod-openapi";

export type RateId = `rate:${string}`;

export const Rate = z
  .object({
    id: z
      .string()
      .regex(/^rate:/, "String must start with 'rate:'")
      .openapi({
        examples: ["rate:anz:standard:18-months"],
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
export interface Rate extends z.infer<typeof Rate> {
  id: RateId;
}
