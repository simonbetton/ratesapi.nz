import { Elysia, t } from "elysia";

import {
  apiResult,
  invalidRequestResult,
  jsonResult,
} from "../../lib/api-result";
import type { ApiResult } from "../../lib/api-result";
import {
  loadLatestData,
  productionLatestDataFallbackUrl,
} from "../../lib/data-loader";
import { getEntityTimeSeries } from "../../lib/entity-time-series";
import type { Environment } from "../../lib/environment";
import { createLogger } from "../../lib/logging";
import { timeSeriesDescription } from "../../lib/openapi";
import type { GetEnv } from "../../lib/routing";
import { termsOfUse } from "../../lib/terms-of-use";
import { getCurrentTimestamp } from "../../lib/transforms";
import {
  InstitutionIdPathParameter,
  InstitutionIdQueryParameter,
  InstitutionNotFoundError,
  InvalidTimeSeriesRequestError,
  ServerError,
  TimeSeriesDateParameter,
  TimeSeriesNotFoundError,
  validateTimeSeriesDateQuery,
} from "../../models/api";
import { CarLoanRates } from "../../models/car-loan-rates";
import {
  CarLoanRatesResponse,
  CarLoanRatesTimeSeriesResponse,
} from "../../models/responses";

type CarLoanTimeSeriesQuery = typeof CarLoanTimeSeriesQuery.static;
type CarLoanInstitutionParams = typeof CarLoanInstitutionParams.static;

const routesLog = createLogger("car-loan-rates-routes");

const CarLoanTimeSeriesQuery = t.Object(
  {
    ...TimeSeriesDateParameter.properties,
    institutionId: t.Optional(InstitutionIdQueryParameter),
  },
  { additionalProperties: false }
);

const CarLoanInstitutionParams = t.Object(
  {
    institutionId: InstitutionIdPathParameter,
  },
  { additionalProperties: false }
);

export function carLoanRatesRoutes(getEnv: GetEnv) {
  return new Elysia({ prefix: "/car-loan-rates" })
    .get(
      "",
      async () => {
        const result = await listCarLoanRates(getEnv());
        return jsonResult(result);
      },
      {
        response: {
          200: CarLoanRatesResponse,
          500: ServerError,
        },
        detail: {
          operationId: "listCarLoanRates",
          tags: ["Car Loan Rates"],
          summary: "Get car loan rates for all institutions",
          description: [
            "This endpoint gets the newest car loan rates for all institutions. Each institution contains products, and each product contains rates.",
            "",
            "A rate can have a plan, for example, `Secured`, and a condition, for example, a loan amount.",
            "",
            "Use this endpoint to compare car loan rates between institutions.",
          ].join("\n"),
        },
      }
    )
    .get(
      "/time-series",
      async ({ query }) => {
        const result = await getCarLoanRatesTimeSeries(getEnv(), query);
        return jsonResult(result);
      },
      {
        query: CarLoanTimeSeriesQuery,
        response: {
          200: CarLoanRatesTimeSeriesResponse,
          400: InvalidTimeSeriesRequestError,
          404: TimeSeriesNotFoundError,
          500: ServerError,
        },
        detail: {
          operationId: "getCarLoanRatesTimeSeries",
          tags: ["Car Loan Rates"],
          summary: "Get historical car loan rates",
          description: timeSeriesDescription({
            rates: "car loan rates",
            filters: [
              "To get only the data for one institution, send `institutionId`.",
            ],
          }),
        },
      }
    )
    .get(
      "/:institutionId",
      async ({ params }) => {
        const result = await getCarLoanRatesByInstitution(getEnv(), params);
        return jsonResult(result);
      },
      {
        params: CarLoanInstitutionParams,
        response: {
          200: CarLoanRatesResponse,
          404: InstitutionNotFoundError,
          500: ServerError,
        },
        detail: {
          operationId: "getCarLoanRatesByInstitution",
          tags: ["Car Loan Rates"],
          summary: "Get car loan rates for one institution",
          description:
            "This endpoint gets the newest car loan rates for one institution. The response has the same structure as the list endpoint, but `data` contains only one institution.",
        },
      }
    );
}

export async function listCarLoanRates(env: Environment): Promise<ApiResult> {
  try {
    const carLoanRates = await loadLatestData(
      "car-loan-rates",
      env.RATESAPI_DB,
      CarLoanRates,
      {
        fallbackUrl: productionLatestDataFallbackUrl(
          "car-loan-rates",
          env.ENVIRONMENT
        ),
      }
    );

    return apiResult(200, {
      ...carLoanRates,
      termsOfUse: termsOfUse(),
      timestamp: getCurrentTimestamp(),
    });
  } catch (error) {
    routesLog.error({ error }, "Error loading car loan rates");
    return apiResult(500, {
      code: 500,
      message: "An error occurred while retrieving car loan rates data",
    });
  }
}

export async function getCarLoanRatesTimeSeries(
  env: Environment,
  query: CarLoanTimeSeriesQuery = {}
): Promise<ApiResult> {
  if (!validateTimeSeriesDateQuery(query)) {
    return invalidRequestResult();
  }

  try {
    const result = await getEntityTimeSeries({
      dataType: "car-loan-rates",
      schema: CarLoanRates,
      responseType: "CarLoanRatesTimeSeries",
      entityName: "institution",
      entityId: query.institutionId,
      date: query.date,
      startDate: query.startDate,
      endDate: query.endDate,
      db: env.RATESAPI_DB,
    });

    return result.ok
      ? apiResult(200, result.body)
      : apiResult(result.status, result.body);
  } catch (error) {
    routesLog.error({ error }, "Error retrieving time series data");
    return apiResult(500, {
      code: 500,
      message: "An error occurred while retrieving time series data",
    });
  }
}

export async function getCarLoanRatesByInstitution(
  env: Environment,
  params: CarLoanInstitutionParams
): Promise<ApiResult> {
  try {
    const carLoanRates = await loadLatestData(
      "car-loan-rates",
      env.RATESAPI_DB,
      CarLoanRates,
      {
        fallbackUrl: productionLatestDataFallbackUrl(
          "car-loan-rates",
          env.ENVIRONMENT
        ),
      }
    );

    const singleInstitution = carLoanRates.data.find(
      (institution) =>
        institution.id.toLowerCase() === params.institutionId.toLowerCase()
    );

    if (!singleInstitution) {
      return apiResult(404, {
        code: 404,
        message: "Institution not found",
      });
    }

    return apiResult(200, {
      ...carLoanRates,
      data: [singleInstitution],
      termsOfUse: termsOfUse(),
      timestamp: getCurrentTimestamp(),
    });
  } catch (error) {
    routesLog.error({ error }, "Error loading car loan rates for institution");
    return apiResult(500, {
      code: 500,
      message:
        "An error occurred while retrieving institution car loan rates data",
    });
  }
}
