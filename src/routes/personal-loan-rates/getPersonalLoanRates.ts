import { createRoute } from "@hono/zod-openapi";
import { ApiError, ApiSuccess } from "../../models/api";

export const getPersonalLoanRatesRoute = createRoute({
  operationId: "getPersonalLoanRates",
  method: "get",
  path: "/",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ApiSuccess,
        },
      },
      description: "Retrieve all personal loan rates for all institutions",
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
