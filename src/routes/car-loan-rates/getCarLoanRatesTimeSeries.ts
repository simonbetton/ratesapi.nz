import { createRoute, z } from "@hono/zod-openapi";
import { GenericApiError, TimeSeriesDateParameter } from "../../models/api";
import { CarLoanRates } from "../../models/car-loan-rates";

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
})

export const getCarLoanRatesTimeSeriesRoute = createRoute({
  operationId: "getCarLoanRatesTimeSeries",
  method: "get",
  path: "/time-series",
  request: {
    query: QuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            type: z.literal("CarLoanRatesTimeSeries").openapi({}),
            timeSeries: z.record(z.string(), CarLoanRates).openapi({
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
      description: "Retrieve car loan rates time series data",
    },
    400: {
      content: {
        "application/json": {
          schema: GenericApiError,
        },
      },
      description: "Invalid date parameters provided",
    },
    404: {
      content: {
        "application/json": {
          schema: GenericApiError,
        },
      },
      description: "No data found for the specified date(s) or institution",
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