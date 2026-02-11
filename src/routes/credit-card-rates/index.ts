import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import {
  getAvailableDates,
  loadHistoricalData,
  loadLatestData,
  NoDataFoundError,
  loadTimeSeriesData
} from "../../lib/data-loader";
import { termsOfUse } from "../../lib/terms-of-use";
import { getCurrentTimestamp } from "../../lib/transforms";
import { CreditCardRates } from "../../models/credit-card-rates";
import { getCreditCardRatesIssuerRoute } from "./getCreditCardRatesIssuer";
import { getCreditCardRatesTimeSeriesRoute } from "./getCreditCardRatesTimeSeries";
import { listCreditCardRatesRoute } from "./listCreditCardRates";

const routes = new OpenAPIHono();

function respondOk<T>(c: Context, payload: T) {
  return c.json(payload, 200);
}

// Route: `GET /credit-card-rates`
routes.openapi(listCreditCardRatesRoute, async (c) => {
  try {
    // Get data from Convex
    const creditCardRates = await loadLatestData("credit-card-rates");

    return respondOk(c, {
      ...creditCardRates,
      termsOfUse: termsOfUse(),
      timestamp: getCurrentTimestamp(),
    });
  } catch (error) {
    if (error instanceof NoDataFoundError) {
      const timestamp = getCurrentTimestamp();
      const emptyRates: CreditCardRates = {
        type: "CreditCardRates",
        data: [],
        lastUpdated: timestamp,
      };

      return respondOk(c, {
        ...emptyRates,
        termsOfUse: termsOfUse(),
        timestamp,
      });
    }

    console.error("Error loading credit card rates:", error);
    return c.json(
      {
        code: 500,
        message: "An error occurred while retrieving credit card rates data",
      },
      500
    );
  }
});

// Route: `GET /credit-card-rates/time-series`
routes.openapi(getCreditCardRatesTimeSeriesRoute, async (c) => {
  const { date, startDate, endDate, issuerId } = c.req.valid("query");
  try {
    const availableDates = await getAvailableDates("credit-card-rates");

    // Check if we have any historical data
    if (availableDates.length === 0) {
      return c.json(
        {
          code: 404,
          message: "No historical data available",
        },
        404,
      );
    }

    // Case 1: Single date requested
    if (date) {
      const historicalData = await loadHistoricalData("credit-card-rates", date);

      if (!historicalData) {
        return c.json(
          {
            code: 404,
            message: `No data available for date: ${date}`,
          },
          404,
        );
      }

      let filteredData = historicalData;

      // Apply issuerId filter if provided
      if (issuerId) {
        filteredData = {
          ...filteredData,
          data: filteredData.data.filter(
            (iss) => iss.id.toLowerCase() === issuerId.toLowerCase()
          ),
        };

        if (filteredData.data.length === 0) {
          return c.json(
            {
              code: 404,
              message: `Issuer not found for date: ${date}`,
            },
            404,
          );
        }
      }

      return respondOk(c, {
        type: "CreditCardRatesTimeSeries",
        timeSeries: { [date]: filteredData },
        availableDates,
        termsOfUse: termsOfUse(),
        timestamp: getCurrentTimestamp(),
      });
    }

    // Case 2: Date range requested
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

      const timeSeriesData = await loadTimeSeriesData(
        "credit-card-rates",
        startDate,
        endDate
      );

      if (Object.keys(timeSeriesData).length === 0) {
        return c.json(
          {
            code: 404,
            message: `No data available between ${startDate} and ${endDate}`,
          },
          404,
        );
      }

      // Apply issuer filter if needed
      if (issuerId) {
        const filteredTimeSeries: Record<string, CreditCardRates> = {};

        for (const [date, data] of Object.entries(timeSeriesData)) {
          let filteredData = { ...data };

          filteredData = {
            ...filteredData,
            data: filteredData.data.filter(
              (iss) => iss.id.toLowerCase() === issuerId.toLowerCase()
            ),
          };

          if (filteredData.data.length > 0) {
            filteredTimeSeries[date] = filteredData;
          }
        }

        if (Object.keys(filteredTimeSeries).length === 0) {
          return c.json(
            {
              code: 404,
              message: `No data found matching the specified issuer`,
            },
            404,
          );
        }

        return respondOk(c, {
          type: "CreditCardRatesTimeSeries",
          timeSeries: filteredTimeSeries,
          availableDates,
          termsOfUse: termsOfUse(),
          timestamp: getCurrentTimestamp(),
        });
      }

      return respondOk(c, {
        type: "CreditCardRatesTimeSeries",
        timeSeries: timeSeriesData,
        availableDates,
        termsOfUse: termsOfUse(),
        timestamp: getCurrentTimestamp(),
      });
    }

    // Case 3: No date parameters provided, return all available dates
    return respondOk(c, {
      type: "CreditCardRatesTimeSeries",
      timeSeries: {},
      availableDates,
      termsOfUse: termsOfUse(),
      timestamp: getCurrentTimestamp(),
    });
  } catch (error) {
    console.error("Error retrieving time series data:", error);
    return c.json(
      {
        code: 500,
        message: "An error occurred while retrieving time series data",
      },
      500
    );
  }
});

// Route: `GET /credit-card-rates/{issuerId}`
routes.openapi(getCreditCardRatesIssuerRoute, async (c) => {
  const { issuerId } = c.req.valid("param");
  try {
    // Get data from Convex
    const creditCardRates = await loadLatestData("credit-card-rates");

    const singleIssuer = creditCardRates.data.find(
      (i) => i.id.toLowerCase() === issuerId.toLowerCase(),
    );

    if (!singleIssuer) {
      return c.json(
        {
          code: 404,
          message: "Issuer not found",
        },
        404,
      );
    }

    return respondOk(c, {
      ...creditCardRates,
      data: [singleIssuer],
      termsOfUse: termsOfUse(),
      timestamp: getCurrentTimestamp(),
    });
  } catch (error) {
    if (error instanceof NoDataFoundError) {
      return c.json(
        {
          code: 404,
          message: "No credit card rates available yet",
        },
        404,
      );
    }

    console.error("Error loading credit card rates for issuer:", error);
    return c.json(
      {
        code: 500,
        message: "An error occurred while retrieving issuer credit card rates data",
      },
      500
    );
  }
});

export { routes };
