import { createRoute, z } from "@hono/zod-openapi";
import { GenericApiError, TimeSeriesDateParameter } from "../../models/api";
import { CreditCardRates } from "../../models/credit-card-rates";

const QuerySchema = TimeSeriesDateParameter.extend({
  issuerId: z
    .string()
    .optional()
    .openapi({
      param: {
        name: "issuerId",
        in: "query",
      },
      description: "Optional issuer ID to filter time series data",
      example: "issuer:visa",
    }),
})

export const getCreditCardRatesTimeSeriesRoute = createRoute({
  operationId: "getCreditCardRatesTimeSeries",
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
            type: z.string().openapi({ example: "CreditCardRatesTimeSeries" }),
            timeSeries: z.record(z.string(), CreditCardRates).openapi({
              description: "Time series data keyed by date in YYYY-MM-DD format",
            }),
            availableDates: z.array(z.string()).openapi({
              description: "List of all available dates in YYYY-MM-DD format",
            }),
            termsOfUse: z.string().openapi({}),
            timestamp: z.string().openapi({
              description: "Current server timestamp",
              example: "2026-03-04T02:30:00.000Z",
            }),
          }),
        },
      },
      description: "Retrieve credit card rates time series data",
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
      description: "No data found for the specified date(s) or issuer",
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
