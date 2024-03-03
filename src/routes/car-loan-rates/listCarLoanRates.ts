import { createRoute, z } from "@hono/zod-openapi";
import { CarLoanRates } from "../../models/car-loan-rates";
import { GenericApiError } from "../../models/api";

export const listCarLoanRatesRoute = createRoute({
  operationId: "listCarLoanRates",
  method: "get",
  path: "/",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: CarLoanRates.extend({
            termsOfUse: z.string().openapi({}),
          }),
        },
      },
      description: "Retrieve all car loan rates for all institutions",
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
