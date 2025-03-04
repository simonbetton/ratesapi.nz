import { createRoute, z } from "@hono/zod-openapi";
import { GenericApiError } from "../../models/api";
import { MortgageRates } from "../../models/mortgage-rates";

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
          schema: MortgageRates.extend({
            termsOfUse: z.string().openapi({}),
            timestamp: z.string().openapi({
              description: "Current server timestamp",
              example: "2025-03-04T02:30:00.000Z",
            }),
          }),
        },
      },
      description: "Retrieve all mortgage rates for all institutions",
    },
    500: {
      content: {
        "application/json": {
          schema: GenericApiError,
        },
      },
      description: "A server error occurred while processing the request",
    },
  },
});
