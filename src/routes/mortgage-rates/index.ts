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
import { MortgageRates } from "../../models/mortgage-rates";
import { getMortgageRatesByInstitutionRoute } from "./getMortgageRatesByInstitution";
import { getMortgageRatesTimeSeriesRoute } from "./getMortgageRatesTimeSeries";
import { listMortgageRatesRoute } from "./listMortgageRates";

const routes = new OpenAPIHono();

function respondOk<T>(c: Context, payload: T) {
  return c.json(payload, 200);
}

// Route: `GET /mortgage-rates`
routes.openapi(listMortgageRatesRoute, async (c) => {
  const { termInMonths } = c.req.valid("query");
  try {
    const mortgageRates = await loadLatestData("mortgage-rates");

    if (termInMonths) {
      const filteredMortgageRates = mortgageRates.data.map(
        (institution) => ({
          ...institution,
          products: institution.products
            .map((product) => ({
              ...product,
              rates: product.rates.filter(
                (rate) => rate.termInMonths === parseInt(termInMonths),
              ),
            }))
            .filter((product) => product.rates.length > 0),
        }),
      );

      return respondOk(c, {
        ...mortgageRates,
        data: filteredMortgageRates,
        termsOfUse: termsOfUse(),
        timestamp: getCurrentTimestamp(),
      });
    }

    return respondOk(c, {
      ...mortgageRates,
      termsOfUse: termsOfUse(),
      timestamp: getCurrentTimestamp(),
    });
  } catch (error) {
    if (error instanceof NoDataFoundError) {
      const timestamp = getCurrentTimestamp();
      const emptyRates: MortgageRates = {
        type: "MortgageRates",
        data: [],
        lastUpdated: timestamp,
      };

      return respondOk(c, {
        ...emptyRates,
        termsOfUse: termsOfUse(),
        timestamp,
      });
    }

    console.error("Error loading mortgage rates:", error);
    return c.json(
      {
        code: 500,
        message: "An error occurred while retrieving mortgage rates data",
      },
      500
    );
  }
});

// Route: `GET /mortgage-rates/time-series`
routes.openapi(getMortgageRatesTimeSeriesRoute, async (c) => {
  const { date, startDate, endDate, institutionId, termInMonths } = c.req.valid("query");
  try {
    const availableDates = await getAvailableDates("mortgage-rates");
    
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
      const historicalData = await loadHistoricalData("mortgage-rates", date);
      
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
      
      // Apply termInMonths filter if provided
      if (termInMonths) {
        const parsedTermInMonths = parseInt(termInMonths);
        
        filteredData = {
          ...filteredData,
          data: filteredData.data.map(institution => ({
            ...institution,
            products: institution.products
              .map(product => ({
                ...product,
                rates: product.rates.filter(
                  rate => rate.termInMonths === parsedTermInMonths
                ),
              }))
              .filter(product => product.rates.length > 0),
          })),
        };
        
        if (filteredData.data.every(inst => inst.products.length === 0)) {
          return c.json(
            {
              code: 404,
              message: `No rates found with term ${termInMonths} months for date: ${date}`,
            },
            404,
          );
        }
      }
      
      return respondOk(c, {
        type: "MortgageRatesTimeSeries",
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
        "mortgage-rates",
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
      
      // Apply filters if needed
      if (institutionId || termInMonths) {
        const filteredTimeSeries: Record<string, MortgageRates> = {};
        
        for (const [date, data] of Object.entries(timeSeriesData)) {
          let filteredData = { ...data };
          
          // Apply institutionId filter
          if (institutionId) {
            filteredData = {
              ...filteredData,
              data: filteredData.data.filter(
                (inst) => inst.id.toLowerCase() === institutionId.toLowerCase()
              ),
            };
            
            if (filteredData.data.length === 0) {
              continue; // Skip this date if no matching institution
            }
          }
          
          // Apply termInMonths filter
          if (termInMonths) {
            const parsedTermInMonths = parseInt(termInMonths);
            
            filteredData = {
              ...filteredData,
              data: filteredData.data.map(institution => ({
                ...institution,
                products: institution.products
                  .map(product => ({
                    ...product,
                    rates: product.rates.filter(
                      rate => rate.termInMonths === parsedTermInMonths
                    ),
                  }))
                  .filter(product => product.rates.length > 0),
              })),
            };
            
            if (filteredData.data.every(inst => inst.products.length === 0)) {
              continue; // Skip this date if no matching rates
            }
          }
          
          filteredTimeSeries[date] = filteredData;
        }
        
        if (Object.keys(filteredTimeSeries).length === 0) {
          return c.json(
            {
              code: 404,
              message: `No data found matching the specified filters`,
            },
            404,
          );
        }
        
        return respondOk(c, {
          type: "MortgageRatesTimeSeries",
          timeSeries: filteredTimeSeries,
          availableDates,
          termsOfUse: termsOfUse(),
          timestamp: getCurrentTimestamp(),
        });
      }
      
      return respondOk(c, {
        type: "MortgageRatesTimeSeries",
        timeSeries: timeSeriesData,
        availableDates,
        termsOfUse: termsOfUse(),
        timestamp: getCurrentTimestamp(),
      });
    }
    
    // Case 3: No date parameters provided, return all available dates
    return respondOk(c, {
      type: "MortgageRatesTimeSeries",
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

// Route: `GET /mortgage-rates/{institutionId}`
routes.openapi(getMortgageRatesByInstitutionRoute, async (c) => {
  const { institutionId } = c.req.valid("param");
  const { termInMonths } = c.req.valid("query");
  try {
    const mortgageRates = await loadLatestData("mortgage-rates");
    
    const singleInstitution = mortgageRates.data.find(
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

    if (termInMonths) {
      const filteredProducts = singleInstitution.products
        .map((product) => ({
          ...product,
          rates: product.rates.filter(
            (rate) => rate.termInMonths === parseInt(termInMonths),
          ),
        }))
        .filter((product) => product.rates.length > 0);

      return respondOk(c, {
        ...mortgageRates,
        data: [
          {
            ...singleInstitution,
            products: filteredProducts,
          },
        ],
        termsOfUse: termsOfUse(),
        timestamp: getCurrentTimestamp(),
      });
    }

    return respondOk(c, {
      ...mortgageRates,
      data: [singleInstitution],
      termsOfUse: termsOfUse(),
      timestamp: getCurrentTimestamp(),
    });
  } catch (error) {
    if (error instanceof NoDataFoundError) {
      return c.json(
        {
          code: 404,
          message: "No mortgage rates available yet",
        },
        404,
      );
    }

    console.error("Error loading mortgage rates for institution:", error);
    return c.json(
      {
        code: 500,
        message: "An error occurred while retrieving institution mortgage rates data",
      },
      500
    );
  }
});

export { routes };
