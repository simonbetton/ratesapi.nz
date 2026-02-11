import { createRoute, z } from "@hono/zod-openapi";
import { GenericApiError } from "../../models/api";
import { CarLoanRates } from "../../models/car-loan-rates";

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
          schema: CarLoanRates.extend({
            termsOfUse: z.string().openapi({}),
            timestamp: z.string().openapi({
              description: "Current server timestamp",
              example: "2026-03-04T02:30:00.000Z",
            }),
          }),
        },
      },
      description: "Retrieve all car loan rates for all institutions",
    },
    404: {
      content: {
        "application/json": {
          schema: GenericApiError,
        },
      },
      description: "Institution not found",
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
