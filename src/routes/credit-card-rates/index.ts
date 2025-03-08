import { OpenAPIHono } from "@hono/zod-openapi";
import {
  getAvailableDates,
  loadHistoricalData,
  loadLatestData,
  loadTimeSeriesData
} from "../../lib/data-loader";
import { Environment } from "../../lib/environment";
import { termsOfUse } from "../../lib/terms-of-use";
import { getCurrentTimestamp } from "../../lib/transforms";
import { CreditCardRates } from "../../models/credit-card-rates";
import { getCreditCardRatesIssuerRoute } from "./getCreditCardRatesIssuer";
import { getCreditCardRatesTimeSeriesRoute } from "./getCreditCardRatesTimeSeries";
import { listCreditCardRatesRoute } from "./listCreditCardRates";

const routes = new OpenAPIHono<{ Bindings: Environment }>();

// Route: `GET /credit-card-rates`
routes.openapi(listCreditCardRatesRoute, async (c) => {
  const db = c.env.RATESAPI_DB;

  try {
    // Get data from D1 database
    const creditCardRates = await loadLatestData<CreditCardRates>("credit-card-rates", db);

    return c.json({
      ...creditCardRates,
      termsOfUse: termsOfUse(),
      timestamp: getCurrentTimestamp(),
    });
  } catch (error) {
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
  const db = c.env.RATESAPI_DB;

  try {
    const availableDates = await getAvailableDates("credit-card-rates", db);

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
      const historicalData = await loadHistoricalData<CreditCardRates>("credit-card-rates", date, db);

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

      return c.json({
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

      const timeSeriesData = await loadTimeSeriesData<CreditCardRates>(
        "credit-card-rates",
        startDate,
        endDate,
        db
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

        return c.json({
          type: "CreditCardRatesTimeSeries",
          timeSeries: filteredTimeSeries,
          availableDates,
          termsOfUse: termsOfUse(),
          timestamp: getCurrentTimestamp(),
        });
      }

      return c.json({
        type: "CreditCardRatesTimeSeries",
        timeSeries: timeSeriesData,
        availableDates,
        termsOfUse: termsOfUse(),
        timestamp: getCurrentTimestamp(),
      });
    }

    // Case 3: No date parameters provided, return all available dates
    return c.json({
      type: "CreditCardRatesTimeSeries",
      timeSeries: {},
      availableDates,
      termsOfUse: termsOfUse(),
      timestamp: getCurrentTimestamp(),
      message: "Please specify a date or date range to retrieve time series data",
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
  const db = c.env.RATESAPI_DB;

  try {
    // Get data from D1 database
    const creditCardRates = await loadLatestData<CreditCardRates>("credit-card-rates", db);

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

    return c.json({
      ...creditCardRates,
      data: [singleIssuer],
      termsOfUse: termsOfUse(),
      timestamp: getCurrentTimestamp(),
    });
  } catch (error) {
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
