import { createRoute } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import { MortgageRates } from "../models/mortgage-rates";
import { ApiError } from "../models/api-error";

const ParamsSchema = z.object({
  term: z
    .string()
    .optional()
    .openapi({
      param: {
        name: "term",
        in: "query",
      },
      examples: ["6 months", "3 years"],
    }),
});

export const getMortgageRatesRoute = createRoute({
  method: "get",
  path: "/mortgage-rates",
  request: {
    query: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MortgageRates,
        },
      },
      description: "Retrieve all mortgage rates for all institutions",
    },
    500: {
      content: {
        "application/json": {
          schema: ApiError,
        },
      },
      description: "A server error occurred while processing the request",
    },
  },
});
