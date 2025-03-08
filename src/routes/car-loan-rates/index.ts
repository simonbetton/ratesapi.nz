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
import { CarLoanRates } from "../../models/car-loan-rates";
import { getCarLoanRatesByInstitutionRoute } from "./getCarLoanRatesByInstitution";
import { getCarLoanRatesTimeSeriesRoute } from "./getCarLoanRatesTimeSeries";
import { listCarLoanRatesRoute } from "./listCarLoanRates";

const routes = new OpenAPIHono<{ Bindings: Environment }>();

// Route: `GET /car-loan-rates`
routes.openapi(listCarLoanRatesRoute, async (c) => {
  const db = c.env.RATESAPI_DB;

  try {
    // Get data from D1 database
    const carLoanRates = await loadLatestData<CarLoanRates>("car-loan-rates", db);

    return c.json({
      ...carLoanRates,
      termsOfUse: termsOfUse(),
      timestamp: getCurrentTimestamp(),
    });
  } catch (error) {
    console.error("Error loading car loan rates:", error);
    return c.json(
      {
        code: 500,
        message: "An error occurred while retrieving car loan rates data",
      },
      500
    );
  }
});

// Route: `GET /car-loan-rates/time-series`
routes.openapi(getCarLoanRatesTimeSeriesRoute, async (c) => {
  const { date, startDate, endDate, institutionId } = c.req.valid("query");
  const db = c.env.RATESAPI_DB;

  try {
    const availableDates = await getAvailableDates("car-loan-rates", db);

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
      const historicalData = await loadHistoricalData<CarLoanRates>("car-loan-rates", date, db);

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

      // Apply institutionId filter if provided
      if (institutionId) {
        filteredData = {
          ...filteredData,
          data: filteredData.data.filter(
            (inst) => inst.id.toLowerCase() === institutionId.toLowerCase()
          ),
        };

        if (filteredData.data.length === 0) {
          return c.json(
            {
              code: 404,
              message: `Institution not found for date: ${date}`,
            },
            404,
          );
        }
      }

      return c.json({
        type: "CarLoanRatesTimeSeries",
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

      const timeSeriesData = await loadTimeSeriesData<CarLoanRates>(
        "car-loan-rates",
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

      // Apply institution filter if needed
      if (institutionId) {
        const filteredTimeSeries: Record<string, CarLoanRates> = {};

        for (const [date, data] of Object.entries(timeSeriesData)) {
          let filteredData = { ...data };

          filteredData = {
            ...filteredData,
            data: filteredData.data.filter(
              (inst) => inst.id.toLowerCase() === institutionId.toLowerCase()
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
              message: `No data found matching the specified institution`,
            },
            404,
          );
        }

        return c.json({
          type: "CarLoanRatesTimeSeries",
          timeSeries: filteredTimeSeries,
          availableDates,
          termsOfUse: termsOfUse(),
          timestamp: getCurrentTimestamp(),
        });
      }

      return c.json({
        type: "CarLoanRatesTimeSeries",
        timeSeries: timeSeriesData,
        availableDates,
        termsOfUse: termsOfUse(),
        timestamp: getCurrentTimestamp(),
      });
    }

    // Case 3: No date parameters provided, return all available dates
    return c.json({
      type: "CarLoanRatesTimeSeries",
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

// Route: `GET /car-loan-rates/{institutionId}`
routes.openapi(getCarLoanRatesByInstitutionRoute, async (c) => {
  const { institutionId } = c.req.valid("param");
  const db = c.env.RATESAPI_DB;

  try {
    // Get data from D1 database
    const carLoanRates = await loadLatestData<CarLoanRates>("car-loan-rates", db);

    const singleInstitution = carLoanRates.data.find(
      (i) => i.id.toLowerCase() === institutionId.toLowerCase(),
    );

    if (!singleInstitution) {
      return c.json(
        {
          code: 404,
          message: "Institution not found",
        },
        404,
      );
    }

    return c.json({
      ...carLoanRates,
      data: [singleInstitution],
      termsOfUse: termsOfUse(),
      timestamp: getCurrentTimestamp(),
    });
  } catch (error) {
    console.error("Error loading car loan rates for institution:", error);
    return c.json(
      {
        code: 500,
        message: "An error occurred while retrieving institution car loan rates data",
      },
      500
    );
  }
});



export { routes };
