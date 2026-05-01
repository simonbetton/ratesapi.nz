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
import { PersonalLoanRates } from "../../models/personal-loan-rates";
import {
  PersonalLoanRatesResponse,
  PersonalLoanRatesTimeSeriesResponse,
} from "../../models/responses";

type PersonalLoanTimeSeriesQuery = typeof PersonalLoanTimeSeriesQuery.static;
type PersonalLoanInstitutionParams =
  typeof PersonalLoanInstitutionParams.static;

const routesLog = createLogger("personal-loan-rates-routes");

const PersonalLoanTimeSeriesQuery = t.Object(
  {
    ...TimeSeriesDateParameter.properties,
    institutionId: t.Optional(
      t.String({
        description: "Optional institution ID to filter time series data",
        examples: ["institution:anz"],
      }),
    ),
  },
  { additionalProperties: false },
);

const PersonalLoanInstitutionParams = t.Object(
  {
    institutionId: t.String({
      examples: [
        "institution:anz",
        "institution:asb",
        "institution:bnz",
        "institution:kiwibank",
        "institution:westpac",
      ],
    }),
  },
  { additionalProperties: false },
);

export function personalLoanRatesRoutes(getEnv: GetEnv) {
  return new Elysia({ prefix: "/personal-loan-rates" })
    .get(
      "/",
      async () => {
        const result = await listPersonalLoanRates(getEnv());
        return jsonResult(result);
      },
      {
        response: {
          200: PersonalLoanRatesResponse,
          500: GenericApiError,
        },
        detail: {
          operationId: "listPersonalLoanRates",
          tags: ["Personal Loan Rates"],
          summary: "List personal loan rates",
        },
      },
    )
    .get(
      "/time-series",
      async ({ query }) => {
        const result = await getPersonalLoanRatesTimeSeries(getEnv(), query);
        return jsonResult(result);
      },
      {
        query: PersonalLoanTimeSeriesQuery,
        response: {
          200: PersonalLoanRatesTimeSeriesResponse,
          400: GenericApiError,
          404: GenericApiError,
          500: GenericApiError,
        },
        detail: {
          operationId: "getPersonalLoanRatesTimeSeries",
          tags: ["Personal Loan Rates"],
          summary: "Get personal loan rates time series",
        },
      },
    )
    .get(
      "/:institutionId",
      async ({ params }) => {
        const result = await getPersonalLoanRatesByInstitution(
          getEnv(),
          params,
        );
        return jsonResult(result);
      },
      {
        params: PersonalLoanInstitutionParams,
        response: {
          200: PersonalLoanRatesResponse,
          404: GenericApiError,
          500: GenericApiError,
        },
        detail: {
          operationId: "getPersonalLoanRatesByInstitution",
          tags: ["Personal Loan Rates"],
          summary: "Get personal loan rates by institution",
        },
      },
    );
}

export async function listPersonalLoanRates(
  env: Environment,
): Promise<ApiResult> {
  try {
    const personalLoanRates = await loadLatestData(
      "personal-loan-rates",
      env.RATESAPI_DB,
      PersonalLoanRates,
      {
        fallbackUrl: productionLatestDataFallbackUrl(
          "personal-loan-rates",
          env.ENVIRONMENT,
        ),
      },
    );

    return apiResult(200, {
      ...personalLoanRates,
      termsOfUse: termsOfUse(),
      timestamp: getCurrentTimestamp(),
    });
  } catch (error) {
    routesLog.error({ error }, "Error loading personal loan rates");
    return apiResult(500, {
      code: 500,
      message: "An error occurred while retrieving personal loan rates data",
    });
  }
}

export async function getPersonalLoanRatesTimeSeries(
  env: Environment,
  query: PersonalLoanTimeSeriesQuery = {},
): Promise<ApiResult> {
  if (!validateTimeSeriesDateQuery(query)) {
    return invalidRequestResult();
  }

  try {
    const result = await getEntityTimeSeries({
      dataType: "personal-loan-rates",
      schema: PersonalLoanRates,
      responseType: "PersonalLoanRatesTimeSeries",
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

export async function getPersonalLoanRatesByInstitution(
  env: Environment,
  params: PersonalLoanInstitutionParams,
): Promise<ApiResult> {
  try {
    const personalLoanRates = await loadLatestData(
      "personal-loan-rates",
      env.RATESAPI_DB,
      PersonalLoanRates,
      {
        fallbackUrl: productionLatestDataFallbackUrl(
          "personal-loan-rates",
          env.ENVIRONMENT,
        ),
      },
    );

    const singleInstitution = personalLoanRates.data.find(
      (institution) =>
        institution.id.toLowerCase() === params.institutionId.toLowerCase(),
    );

    if (!singleInstitution) {
      return apiResult(404, {
        code: 404,
        message: "Institution not found",
      });
    }

    return apiResult(200, {
      ...personalLoanRates,
      data: [singleInstitution],
      termsOfUse: termsOfUse(),
      timestamp: getCurrentTimestamp(),
    });
  } catch (error) {
    routesLog.error(
      { error },
      "Error loading personal loan rates for institution",
    );
    return apiResult(500, {
      code: 500,
      message:
        "An error occurred while retrieving institution personal loan rates data",
    });
  }
}
