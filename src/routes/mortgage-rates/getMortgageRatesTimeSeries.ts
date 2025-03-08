import { createRoute, z } from "@hono/zod-openapi";
import { GenericApiError, TimeSeriesDateParameter } from "../../models/api";
import { MortgageRates } from "../../models/mortgage-rates";

const QuerySchema = TimeSeriesDateParameter.extend({
  institutionId: z
    .string()
    .optional()
    .openapi({
      param: {
        name: "institutionId",
        in: "query",
      },
      description: "Optional institution ID to filter time series data",
      example: "institution:anz",
    }),
  termInMonths: z
    .string()
    .optional()
    .openapi({
      param: {
        name: "termInMonths",
        in: "query",
      },
      description: "Optional mortgage term in months to filter by",
      examples: ["6", "12", "24", "36"],
    }),
});

export const getMortgageRatesTimeSeriesRoute = createRoute({
  operationId: "getMortgageRatesTimeSeries",
  method: "get",
  path: "/time-series",
  request: {
    query: QuerySchema
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            type: z.literal("MortgageRatesTimeSeries").openapi({}),
            timeSeries: z.record(z.string(), MortgageRates).openapi({
              description: "Time series data keyed by date in YYYY-MM-DD format",
            }),
            availableDates: z.array(z.string()).openapi({
              description: "List of all available dates in YYYY-MM-DD format",
            }),
            termsOfUse: z.string().openapi({}),
            timestamp: z.string().openapi({
              description: "Current server timestamp",
              example: "2025-03-04T02:30:00.000Z",
            }),
          }),
        },
      },
      description: "Retrieve mortgage rates time series data",
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