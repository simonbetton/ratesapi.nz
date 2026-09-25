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
import { type Environment } from "../../lib/environment";
import { createLogger } from "../../lib/logging";
import { getMortgageTimeSeries } from "../../lib/mortgage-time-series";
import { timeSeriesDescription } from "../../lib/openapi";
import { type GetEnv } from "../../lib/routing";
import { termsOfUse } from "../../lib/terms-of-use";
import { getCurrentTimestamp } from "../../lib/transforms";
import {
  InstitutionIdPathParameter,
  InstitutionIdQueryParameter,
  InstitutionNotFoundError,
  InvalidRequestError,
  InvalidTimeSeriesRequestError,
  ServerError,
  TermInMonthsParameter,
  TimeSeriesDateParameter,
  TimeSeriesNotFoundError,
  validateTimeSeriesDateQuery,
} from "../../models/api";
import { MortgageRates } from "../../models/mortgage-rates";
import {
  MortgageRatesResponse,
  MortgageRatesTimeSeriesResponse,
} from "../../models/responses";

type MortgageListQuery = typeof MortgageListQuery.static;
type MortgageTimeSeriesQuery = typeof MortgageTimeSeriesQuery.static;
type MortgageInstitutionParams = typeof MortgageInstitutionParams.static;

const routesLog = createLogger("mortgage-rates-routes");

const MortgageListQuery = t.Object(
  {
    termInMonths: t.Optional(TermInMonthsParameter),
  },
  { additionalProperties: false },
);

const MortgageTimeSeriesQuery = t.Object(
  {
    ...TimeSeriesDateParameter.properties,
    institutionId: t.Optional(InstitutionIdQueryParameter),
    termInMonths: t.Optional(TermInMonthsParameter),
  },
  { additionalProperties: false },
);

const MortgageInstitutionParams = t.Object(
  {
    institutionId: InstitutionIdPathParameter,
  },
  { additionalProperties: false },
);

export function mortgageRatesRoutes(getEnv: GetEnv) {
  return new Elysia({ prefix: "/mortgage-rates" })
    .get(
      "",
      async ({ query }) => {
        const result = await listMortgageRates(getEnv(), query);
        return jsonResult(result);
      },
      {
        query: MortgageListQuery,
        response: {
          200: MortgageRatesResponse,
          400: InvalidRequestError,
          500: ServerError,
        },
        detail: {
          operationId: "listMortgageRates",
          tags: ["Mortgage Rates"],
          summary: "Get mortgage rates for all institutions",
          description: [
            "This endpoint gets the newest mortgage rates for all institutions. Each institution contains products, and each product contains rates.",
            "",
            "To get only the rates for one fixed term, send `termInMonths`.",
            "",
            "Use this endpoint to compare mortgage rates between institutions.",
          ].join("\n"),
        },
      },
    )
    .get(
      "/time-series",
      async ({ query }) => {
        const result = await getMortgageRatesTimeSeries(getEnv(), query);
        return jsonResult(result);
      },
      {
        query: MortgageTimeSeriesQuery,
        response: {
          200: MortgageRatesTimeSeriesResponse,
          400: InvalidTimeSeriesRequestError,
          404: TimeSeriesNotFoundError,
          500: ServerError,
        },
        detail: {
          operationId: "getMortgageRatesTimeSeries",
          tags: ["Mortgage Rates"],
          summary: "Get historical mortgage rates",
          description: timeSeriesDescription({
            rates: "mortgage rates",
            filters: [
              "To get only the data for one institution, send `institutionId`. To get only the rates for one fixed term, send `termInMonths`.",
            ],
          }),
        },
      },
    )
    .get(
      "/:institutionId",
      async ({ params, query }) => {
        const result = await getMortgageRatesByInstitution(
          getEnv(),
          params,
          query,
        );
        return jsonResult(result);
      },
      {
        params: MortgageInstitutionParams,
        query: MortgageListQuery,
        response: {
          200: MortgageRatesResponse,
          400: InvalidRequestError,
          404: InstitutionNotFoundError,
          500: ServerError,
        },
        detail: {
          operationId: "getMortgageRatesByInstitution",
          tags: ["Mortgage Rates"],
          summary: "Get mortgage rates for one institution",
          description: [
            "This endpoint gets the newest mortgage rates for one institution. The response has the same structure as the list endpoint, but `data` contains only one institution.",
            "",
            "To get only the rates for one fixed term, send `termInMonths`.",
          ].join("\n"),
        },
      },
    );
}

export async function listMortgageRates(
  env: Environment,
  query: MortgageListQuery = {},
): Promise<ApiResult> {
  if (hasInvalidTerm(query.termInMonths)) {
    return invalidRequestResult();
  }

  try {
    const mortgageRates = await loadLatestData(
      "mortgage-rates",
      env.RATESAPI_DB,
      MortgageRates,
      {
        fallbackUrl: productionLatestDataFallbackUrl(
          "mortgage-rates",
          env.ENVIRONMENT,
        ),
      },
    );

    if (query.termInMonths) {
      const termInMonths = parseInt(query.termInMonths, 10);
      const filteredMortgageRates = mortgageRates.data.map((institution) => ({
        ...institution,
        products: institution.products
          .map((product) => ({
            ...product,
            rates: product.rates.filter(
              (rate) => rate.termInMonths === termInMonths,
            ),
          }))
          .filter((product) => product.rates.length > 0),
      }));

      return apiResult(200, {
        ...mortgageRates,
        data: filteredMortgageRates,
        termsOfUse: termsOfUse(),
        timestamp: getCurrentTimestamp(),
      });
    }

    return apiResult(200, {
      ...mortgageRates,
      termsOfUse: termsOfUse(),
      timestamp: getCurrentTimestamp(),
    });
  } catch (error) {
    routesLog.error({ error }, "Error loading mortgage rates");
    return apiResult(500, {
      code: 500,
      message: "An error occurred while retrieving mortgage rates data",
    });
  }
}

export async function getMortgageRatesTimeSeries(
  env: Environment,
  query: MortgageTimeSeriesQuery = {},
): Promise<ApiResult> {
  if (
    !validateTimeSeriesDateQuery(query) ||
    hasInvalidTerm(query.termInMonths)
  ) {
    return invalidRequestResult();
  }

  try {
    const result = await getMortgageTimeSeries({
      ...query,
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

export async function getMortgageRatesByInstitution(
  env: Environment,
  params: MortgageInstitutionParams,
  query: MortgageListQuery = {},
): Promise<ApiResult> {
  if (hasInvalidTerm(query.termInMonths)) {
    return invalidRequestResult();
  }

  try {
    const mortgageRates = await loadLatestData(
      "mortgage-rates",
      env.RATESAPI_DB,
      MortgageRates,
      {
        fallbackUrl: productionLatestDataFallbackUrl(
          "mortgage-rates",
          env.ENVIRONMENT,
        ),
      },
    );

    const singleInstitution = mortgageRates.data.find(
      (institution) =>
        institution.id.toLowerCase() === params.institutionId.toLowerCase(),
    );

    if (!singleInstitution) {
      return apiResult(404, {
        code: 404,
        message: "Institution not found",
      });
    }

    if (query.termInMonths) {
      const termInMonths = parseInt(query.termInMonths, 10);
      const filteredProducts = singleInstitution.products
        .map((product) => ({
          ...product,
          rates: product.rates.filter(
            (rate) => rate.termInMonths === termInMonths,
          ),
        }))
        .filter((product) => product.rates.length > 0);

      return apiResult(200, {
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

    return apiResult(200, {
      ...mortgageRates,
      data: [singleInstitution],
      termsOfUse: termsOfUse(),
      timestamp: getCurrentTimestamp(),
    });
  } catch (error) {
    routesLog.error({ error }, "Error loading mortgage rates for institution");
    return apiResult(500, {
      code: 500,
      message:
        "An error occurred while retrieving institution mortgage rates data",
    });
  }
}

function hasInvalidTerm(termInMonths?: string): boolean {
  return termInMonths !== undefined && !/^\d+$/.test(termInMonths);
}
