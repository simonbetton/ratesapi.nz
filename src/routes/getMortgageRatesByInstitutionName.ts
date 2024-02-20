import { createRoute } from "@hono/zod-openapi";
import { MortgageRates, ParamsSchema } from "../models/mortgage-rates";
import { ApiError } from "../models/api-error";

export const getMortgageRatesByInstitutionNameRoute = createRoute({
  method: "get",
  path: "/mortgage-rates/{institution}",
  request: {
    params: ParamsSchema,
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
