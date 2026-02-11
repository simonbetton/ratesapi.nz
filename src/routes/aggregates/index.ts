import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";

import {
  getAvailableDates,
  loadAggregateByDate,
  loadAggregateTimeSeries,
} from "../../lib/data-loader";
import { GenericApiError, TimeSeriesDateParameter } from "../../models/api";
import { termsOfUse } from "../../lib/terms-of-use";
import { getCurrentTimestamp } from "../../lib/transforms";
import { isDataType } from "../../lib/data-types";

const routes = new OpenAPIHono();

const dataTypeValues = [
  "mortgage-rates",
  "personal-loan-rates",
  "car-loan-rates",
  "credit-card-rates",
] satisfies readonly [
  "mortgage-rates",
  "personal-loan-rates",
  "car-loan-rates",
  "credit-card-rates",
];

const getAggregatesRoute = createRoute({
  operationId: "getAggregatesByDataType",
  method: "get",
  path: "/{dataType}",
  request: {
    params: z.object({
      dataType: z.enum(dataTypeValues).openapi({
        examples: ["mortgage-rates", "credit-card-rates"],
        param: {
          in: "path",
          name: "dataType",
        },
      }),
    }),
    query: TimeSeriesDateParameter,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            aggregate: z.any().optional(),
            availableDates: z.array(z.string()),
            dataType: z.enum(dataTypeValues),
            message: z.string().optional(),
            termsOfUse: z.string(),
            timeSeries: z.record(z.string(), z.any()).optional(),
            timestamp: z.string(),
          }),
        },
      },
      description: "Aggregate data payload",
    },
    400: {
      content: {
        "application/json": {
          schema: GenericApiError,
        },
      },
      description: "Invalid request",
    },
    404: {
      content: {
        "application/json": {
          schema: GenericApiError,
        },
      },
      description: "Aggregate data not found",
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

function respondOk<T>(c: Context, payload: T) {
  return c.json(payload, 200);
}

routes.openapi(getAggregatesRoute, async (c) => {
  const dataTypeCandidate = c.req.param("dataType");

  if (!isDataType(dataTypeCandidate)) {
    return c.json(
      {
        code: 400,
        message: `Unsupported dataType: ${dataTypeCandidate}`,
      },
      400,
    );
  }

  const dataType = dataTypeCandidate;
  const date = c.req.query("date");
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");

  try {
    const availableDates = await getAvailableDates(dataType);

    if (date) {
      const aggregate = await loadAggregateByDate(dataType, date);

      if (!aggregate) {
        return c.json(
          {
            code: 404,
            message: `No aggregate data available for ${dataType} on ${date}`,
          },
          404,
        );
      }

      return respondOk(c, {
        aggregate,
        availableDates,
        dataType,
        termsOfUse: termsOfUse(),
        timestamp: getCurrentTimestamp(),
      });
    }

    if (startDate && endDate) {
      if (startDate > endDate) {
        return c.json(
          {
            code: 400,
            message: "Start date cannot be after end date",
          },
          400,
        );
      }

      const timeSeries = await loadAggregateTimeSeries(dataType, startDate, endDate);

      return respondOk(c, {
        availableDates,
        dataType,
        termsOfUse: termsOfUse(),
        timeSeries,
        timestamp: getCurrentTimestamp(),
      });
    }

    return respondOk(c, {
      availableDates,
      dataType,
      message: "Specify date or startDate/endDate to retrieve aggregate data",
      termsOfUse: termsOfUse(),
      timestamp: getCurrentTimestamp(),
    });
  } catch (error) {
    console.error("Error retrieving aggregate data:", error);
    return c.json(
      {
        code: 500,
        message: "An error occurred while retrieving aggregate data",
      },
      500,
    );
  }
});

export { routes };
