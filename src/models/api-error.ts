import { z } from "@hono/zod-openapi";

export const ApiError = z.object({
  code: z.number().openapi({
    example: 500,
  }),
  message: z.string().openapi({
    example: "Internal Server Error",
  }),
});
