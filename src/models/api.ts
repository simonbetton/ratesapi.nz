import { z } from "@hono/zod-openapi";

export const GenericApiError = z.object({
  code: z.number().openapi({
    examples: [404, 500],
  }),
  message: z.string().openapi({
    examples: ["Internal Server Error"],
  }),
});
