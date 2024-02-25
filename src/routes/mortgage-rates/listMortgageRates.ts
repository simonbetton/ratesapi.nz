import { createRoute } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import { ApiError, ApiSuccess } from "../../models/api";

const QuerySchema = z.object({
  termInMonths: z
    .string()
    .optional()
    .openapi({
      param: {
        name: "termInMonths",
        in: "query",
      },
      examples: ["6", "12", "24", "36"],
    }),
});

export const listMortgageRatesRoute = createRoute({
  operationId: "listMortgageRates",
  method: "get",
  path: "/",
  request: {
    query: QuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ApiSuccess,
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
