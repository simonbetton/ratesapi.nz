import { createRoute } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import { ApiError, ApiSuccess } from "../../models/api";

const ParamsSchema = z.object({
  institutionId: z.string().openapi({
    param: {
      name: "institutionId",
      in: "path",
    },
    examples: ["institution:asb", "institution:kiwibank"],
  }),
});

export const getCarLoanRatesByInstitutionRoute = createRoute({
  operationId: "getCarLoanRatesByInstitution",
  method: "get",
  path: "/{institutionId}",
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
      description: "Retrieve all car loan rates for all institutions",
    },
    404: {
      content: {
        "application/json": {
          schema: ApiError,
        },
      },
      description: "Institution not found",
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
