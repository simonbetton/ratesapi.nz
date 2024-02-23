import { createRoute } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import { ApiError, ApiSuccess } from "../../models/api";

const ParamsSchema = z.object({
  institution: z.string().openapi({
    param: {
      name: "institution",
      in: "path",
    },
    examples: ["anz", "kiwibank", "westpac"],
  }),
});

export const getPersonalLoanRatesByInstitutionRoute = createRoute({
  operationId: "getPersonalLoanRatesByInstitution",
  method: "get",
  path: "/{institution}",
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
