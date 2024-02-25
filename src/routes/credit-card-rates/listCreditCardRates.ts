import { createRoute } from "@hono/zod-openapi";
import { ApiError, ApiSuccess } from "../../models/api";

export const listCreditCardRatesRoute = createRoute({
  operationId: "listCreditCardRates",
  method: "get",
  path: "/",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ApiSuccess,
        },
      },
      description: "Retrieve all credit card rates for all institutions",
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
