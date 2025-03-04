import { createRoute, z } from "@hono/zod-openapi";
import { GenericApiError } from "../../models/api";
import { PersonalLoanRates } from "../../models/personal-loan-rates";

export const listPersonalLoanRatesRoute = createRoute({
  operationId: "listPersonalLoanRates",
  method: "get",
  path: "/",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: PersonalLoanRates.extend({
            termsOfUse: z.string().openapi({}),
            timestamp: z.string().openapi({
              description: "Current server timestamp",
              example: "2025-03-04T02:30:00.000Z",
            }),
          }),
        },
      },
      description: "Retrieve all personal loan rates for all institutions",
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
