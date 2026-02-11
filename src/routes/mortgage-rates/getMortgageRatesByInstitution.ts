import { createRoute, z } from "@hono/zod-openapi";
import { GenericApiError } from "../../models/api";
import { MortgageRates } from "../../models/mortgage-rates";

const ParamsSchema = z.object({
  institutionId: z.string().openapi({
    param: {
      name: "institutionId",
      in: "path",
    },
    examples: [
      "institution:anz",
      "institution:asb",
      "institution:bnz",
      "institution:kiwibank",
      "institution:westpac",
    ],
  }),
});

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

export const getMortgageRatesByInstitutionRoute = createRoute({
  operationId: "getMortgageRatesByInstitution",
  method: "get",
  path: "/{institutionId}",
  request: {
    params: ParamsSchema,
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
              example: "2026-03-04T02:30:00.000Z",
            }),
          }),
        },
      },
      description: "Retrieve all mortgage rates for all institutions",
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
