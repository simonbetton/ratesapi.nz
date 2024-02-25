import { createRoute } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import { ApiError, ApiSuccess } from "../../models/api";

const ParamsSchema = z.object({
  issuerId: z.string().openapi({
    param: {
      name: "issuerId",
      in: "path",
    },
    examples: ["issuer:amex", "issuer:gem"],
  }),
});

export const getCreditCardRatesIssuerRoute = createRoute({
  operationId: "getCreditCardRatesIssuer",
  method: "get",
  path: "/{issuerId}",
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ApiSuccess,
        },
      },
      description: "Retrieve all credit card rates for all institutions",
    },
    404: {
      content: {
        "application/json": {
          schema: ApiError,
        },
      },
      description: "Issuer not found",
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
