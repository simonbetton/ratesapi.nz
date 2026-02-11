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
import { PersonalLoanRates } from "../../models/personal-loan-rates";
import { getPersonalLoanRatesByInstitutionRoute } from "./getPersonalLoanRatesByInstitution";
import { getPersonalLoanRatesTimeSeriesRoute } from "./getPersonalLoanRatesTimeSeries";
import { listPersonalLoanRatesRoute } from "./listPersonalLoanRates";

const routes = new OpenAPIHono();

function respondOk<T>(c: Context, payload: T) {
  return c.json(payload, 200);
}

// Route: `GET /personal-loan-rates`
routes.openapi(listPersonalLoanRatesRoute, async (c) => {
  try {
    // Get data from Convex
    const personalLoanRates = await loadLatestData("personal-loan-rates");

    return respondOk(c, {
      ...personalLoanRates,
      termsOfUse: termsOfUse(),
      timestamp: getCurrentTimestamp(),
    });
  } catch (error) {
    if (error instanceof NoDataFoundError) {
      const timestamp = getCurrentTimestamp();
      const emptyRates: PersonalLoanRates = {
        type: "PersonalLoanRates",
        data: [],
        lastUpdated: timestamp,
      };

      return respondOk(c, {
        ...emptyRates,
        termsOfUse: termsOfUse(),
        timestamp,
      });
    }

    console.error("Error loading personal loan rates:", error);
    return c.json(
      {
        code: 500,
        message: "An error occurred while retrieving personal loan rates data",
      },
      500
    );
  }
});

// Route: `GET /personal-loan-rates/time-series`
routes.openapi(getPersonalLoanRatesTimeSeriesRoute, async (c) => {
  const { date, startDate, endDate, institutionId } = c.req.valid("query");
  try {
    const availableDates = await getAvailableDates("personal-loan-rates");

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
      const historicalData = await loadHistoricalData("personal-loan-rates", date);

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

      return respondOk(c, {
        type: "PersonalLoanRatesTimeSeries",
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
        "personal-loan-rates",
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

      // Apply institution filter if needed
      if (institutionId) {
        const filteredTimeSeries: Record<string, PersonalLoanRates> = {};

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

        return respondOk(c, {
          type: "PersonalLoanRatesTimeSeries",
          timeSeries: filteredTimeSeries,
          availableDates,
          termsOfUse: termsOfUse(),
          timestamp: getCurrentTimestamp(),
        });
      }

      return respondOk(c, {
        type: "PersonalLoanRatesTimeSeries",
        timeSeries: timeSeriesData,
        availableDates,
        termsOfUse: termsOfUse(),
        timestamp: getCurrentTimestamp(),
      });
    }

    // Case 3: No date parameters provided, return all available dates
    return respondOk(c, {
      type: "PersonalLoanRatesTimeSeries",
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

// Route: `GET /personal-loan-rates/{institutionId}`
routes.openapi(getPersonalLoanRatesByInstitutionRoute, async (c) => {
  const { institutionId } = c.req.valid("param");
  try {
    // Get data from Convex
    const personalLoanRates = await loadLatestData("personal-loan-rates");

    const singleInstitution = personalLoanRates.data.find(
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

    return respondOk(c, {
      ...personalLoanRates,
      data: [singleInstitution],
      termsOfUse: termsOfUse(),
      timestamp: getCurrentTimestamp(),
    });
  } catch (error) {
    if (error instanceof NoDataFoundError) {
      return c.json(
        {
          code: 404,
          message: "No personal loan rates available yet",
        },
        404,
      );
    }

    console.error("Error loading personal loan rates for institution:", error);
    return c.json(
      {
        code: 500,
        message: "An error occurred while retrieving institution personal loan rates data",
      },
      500
    );
  }
});

export { routes };
