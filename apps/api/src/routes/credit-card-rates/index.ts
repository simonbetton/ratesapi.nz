import { Elysia, t } from "elysia";
import {
  type ApiResult,
  apiResult,
  invalidRequestResult,
  jsonResult,
} from "../../lib/api-result";
import {
  loadLatestData,
  productionLatestDataFallbackUrl,
} from "../../lib/data-loader";
import { getEntityTimeSeries } from "../../lib/entity-time-series";
import { type Environment } from "../../lib/environment";
import { createLogger } from "../../lib/logging";
import { type GetEnv } from "../../lib/routing";
import { termsOfUse } from "../../lib/terms-of-use";
import { getCurrentTimestamp } from "../../lib/transforms";
import {
  GenericApiError,
  TimeSeriesDateParameter,
  validateTimeSeriesDateQuery,
} from "../../models/api";
import { CreditCardRates } from "../../models/credit-card-rates";
import {
  CreditCardRatesResponse,
  CreditCardRatesTimeSeriesResponse,
} from "../../models/responses";

type CreditCardTimeSeriesQuery = typeof CreditCardTimeSeriesQuery.static;
type CreditCardIssuerParams = typeof CreditCardIssuerParams.static;

const routesLog = createLogger("credit-card-rates-routes");

const CreditCardTimeSeriesQuery = t.Object(
  {
    ...TimeSeriesDateParameter.properties,
    issuerId: t.Optional(
      t.String({
        description: "Optional issuer ID to filter time series data",
        examples: ["issuer:anz"],
      }),
    ),
  },
  { additionalProperties: false },
);

const CreditCardIssuerParams = t.Object(
  {
    issuerId: t.String({
      examples: ["issuer:anz", "issuer:amex", "issuer:gem"],
    }),
  },
  { additionalProperties: false },
);

export function creditCardRatesRoutes(getEnv: GetEnv) {
  return new Elysia({ prefix: "/credit-card-rates" })
    .get(
      "/",
      async () => {
        const result = await listCreditCardRates(getEnv());
        return jsonResult(result);
      },
      {
        response: {
          200: CreditCardRatesResponse,
          500: GenericApiError,
        },
        detail: {
          operationId: "listCreditCardRates",
          tags: ["Credit Card Rates"],
          summary: "List credit card rates",
        },
      },
    )
    .get(
      "/time-series",
      async ({ query }) => {
        const result = await getCreditCardRatesTimeSeries(getEnv(), query);
        return jsonResult(result);
      },
      {
        query: CreditCardTimeSeriesQuery,
        response: {
          200: CreditCardRatesTimeSeriesResponse,
          400: GenericApiError,
          404: GenericApiError,
          500: GenericApiError,
        },
        detail: {
          operationId: "getCreditCardRatesTimeSeries",
          tags: ["Credit Card Rates"],
          summary: "Get credit card rates time series",
        },
      },
    )
    .get(
      "/:issuerId",
      async ({ params }) => {
        const result = await getCreditCardRatesByIssuer(getEnv(), params);
        return jsonResult(result);
      },
      {
        params: CreditCardIssuerParams,
        response: {
          200: CreditCardRatesResponse,
          404: GenericApiError,
          500: GenericApiError,
        },
        detail: {
          operationId: "getCreditCardRatesByIssuer",
          tags: ["Credit Card Rates"],
          summary: "Get credit card rates by issuer",
        },
      },
    );
}

export async function listCreditCardRates(
  env: Environment,
): Promise<ApiResult> {
  try {
    const creditCardRates = await loadLatestData(
      "credit-card-rates",
      env.RATESAPI_DB,
      CreditCardRates,
      {
        fallbackUrl: productionLatestDataFallbackUrl(
          "credit-card-rates",
          env.ENVIRONMENT,
        ),
      },
    );

    return apiResult(200, {
      ...creditCardRates,
      termsOfUse: termsOfUse(),
      timestamp: getCurrentTimestamp(),
    });
  } catch (error) {
    routesLog.error({ error }, "Error loading credit card rates");
    return apiResult(500, {
      code: 500,
      message: "An error occurred while retrieving credit card rates data",
    });
  }
}

export async function getCreditCardRatesTimeSeries(
  env: Environment,
  query: CreditCardTimeSeriesQuery = {},
): Promise<ApiResult> {
  if (!validateTimeSeriesDateQuery(query)) {
    return invalidRequestResult();
  }

  try {
    const result = await getEntityTimeSeries({
      dataType: "credit-card-rates",
      schema: CreditCardRates,
      responseType: "CreditCardRatesTimeSeries",
      entityName: "issuer",
      entityId: query.issuerId,
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

export async function getCreditCardRatesByIssuer(
  env: Environment,
  params: CreditCardIssuerParams,
): Promise<ApiResult> {
  try {
    const creditCardRates = await loadLatestData(
      "credit-card-rates",
      env.RATESAPI_DB,
      CreditCardRates,
      {
        fallbackUrl: productionLatestDataFallbackUrl(
          "credit-card-rates",
          env.ENVIRONMENT,
        ),
      },
    );

    const singleIssuer = creditCardRates.data.find(
      (issuer) => issuer.id.toLowerCase() === params.issuerId.toLowerCase(),
    );

    if (!singleIssuer) {
      return apiResult(404, {
        code: 404,
        message: "Issuer not found",
      });
    }

    return apiResult(200, {
      ...creditCardRates,
      data: [singleIssuer],
      termsOfUse: termsOfUse(),
      timestamp: getCurrentTimestamp(),
    });
  } catch (error) {
    routesLog.error({ error }, "Error loading credit card rates for issuer");
    return apiResult(500, {
      code: 500,
      message:
        "An error occurred while retrieving issuer credit card rates data",
    });
  }
}
