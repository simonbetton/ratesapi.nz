import { t } from "elysia";

import { nullable } from "../lib/schema";

export function isValidIsoDate(value: string): boolean {
  const groups = value.match(
    /^(?<yearValue>\d{4})-(?<monthValue>\d{2})-(?<dayValue>\d{2})$/u
  )?.groups;

  if (!groups) {
    return false;
  }

  const year = Number(groups.yearValue);
  const month = Number(groups.monthValue);
  const day = Number(groups.dayValue);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const TermInMonthsParameter = t.String({
  pattern: "^\\d+$",
  description:
    "The fixed mortgage term in months. Use digits only. For example, `12` is a fixed term of 1 year. The data contains terms of 6, 12, 18, 24, 36, 48, and 60 months. When you use this parameter, the response does not contain variable floating rates.",
  examples: ["12"],
});

export const InstitutionIdPathParameter = t.String({
  description:
    "The ID of the institution. Use the `id` of an institution from the list endpoint. You can use upper-case or lower-case letters.",
  examples: [
    "institution:anz",
    "institution:asb",
    "institution:bnz",
    "institution:kiwibank",
    "institution:westpac",
  ],
});

export const InstitutionIdQueryParameter = t.String({
  description:
    "The ID of an institution. When you use this parameter, the response contains only the data for this institution. You can use upper-case or lower-case letters.",
  examples: ["institution:anz"],
});

export const IssuerIdPathParameter = t.String({
  description:
    "The ID of the credit card issuer. Use the `id` of an issuer from the list endpoint. You can use upper-case or lower-case letters.",
  examples: ["issuer:anz", "issuer:amex", "issuer:gem"],
});

export const IssuerIdQueryParameter = t.String({
  description:
    "The ID of a credit card issuer. When you use this parameter, the response contains only the data for this issuer. You can use upper-case or lower-case letters.",
  examples: ["issuer:anz"],
});

// All error responses have the same JSON shape. `error` is a code that does
// not change, so a client or an agent can find the cause without reading
// `message`. `hint` tells the client how to correct the request.
const openApiDocumentUrl = "https://www.ratesapi.nz/openapi.json";
const referenceDocsUrl = "https://www.ratesapi.nz/docs/api-reference";

const apiErrorKinds = {
  invalid_request: {
    code: 400,
    hint: `Make sure that each parameter has the correct name and format. Dates use the YYYY-MM-DD format. For the parameters of each endpoint, refer to ${openApiDocumentUrl}.`,
    documentationUrl: `${referenceDocsUrl}#filters`,
  },
  not_found: {
    code: 404,
    hint: `Make sure that the method and the path are correct. The data endpoints start with /api/v1/. For all endpoints, refer to ${openApiDocumentUrl}.`,
    documentationUrl: `${referenceDocsUrl}#endpoint-groups`,
  },
  institution_not_found: {
    code: 404,
    hint: "Use the id of an institution from the list endpoint of the dataset.",
    documentationUrl: `${referenceDocsUrl}/concepts#identifiers`,
  },
  issuer_not_found: {
    code: 404,
    hint: "Use the id of an issuer from GET /api/v1/credit-card-rates.",
    documentationUrl: `${referenceDocsUrl}/concepts#identifiers`,
  },
  no_data: {
    code: 404,
    hint: "Send a date from availableDates. To get this list, send the request with no dates.",
    documentationUrl: `${referenceDocsUrl}/concepts#date-filters`,
  },
  server_error: {
    code: 500,
    hint: "Send the request again later. If the error continues, send GET /api/v1/health to see the status of each dataset.",
    documentationUrl: `${referenceDocsUrl}/concepts#data-freshness`,
  },
} as const;

export type ApiErrorCode = keyof typeof apiErrorKinds;
export type ApiEntity = "institution" | "issuer";

export interface ApiErrorBody {
  code: (typeof apiErrorKinds)[ApiErrorCode]["code"];
  error: ApiErrorCode;
  message: string;
  hint: string;
  documentationUrl: string;
}

export function apiError(
  error: ApiErrorCode,
  message: string,
  hint?: string
): ApiErrorBody {
  const kind = apiErrorKinds[error];

  return {
    code: kind.code,
    error,
    message,
    hint: hint ?? kind.hint,
    documentationUrl: kind.documentationUrl,
  };
}

// The hint names the endpoint that lists the correct IDs.
export function entityNotFoundError(
  entity: ApiEntity,
  listPath: string,
  message: string
): ApiErrorBody {
  return apiError(
    `${entity}_not_found`,
    message,
    `Use the id of an ${entity} from GET ${listPath}.`
  );
}

// The errors that all time-series endpoints share.
export const timeSeriesErrors = {
  noSnapshots: (listPath: string) =>
    apiError(
      "no_data",
      "No historical data available",
      `The API has no snapshots of this dataset. To get the newest data, send GET ${listPath}.`
    ),
  noSnapshotForDate: (date: string) =>
    apiError("no_data", `No data available for date: ${date}`),
  noSnapshotInRange: (startDate: string, endDate: string) =>
    apiError(
      "no_data",
      `No data available between ${startDate} and ${endDate}`
    ),
  startAfterEnd: () =>
    apiError(
      "invalid_request",
      "Start date cannot be after end date",
      "Send a startDate that is on or before endDate."
    ),
};

function errorResponse(options: {
  errors: readonly [ApiErrorCode, ...ApiErrorCode[]];
  description: string;
  messageExamples: string[];
}) {
  const kind = apiErrorKinds[options.errors[0]];

  return t.Object(
    {
      code: t.Literal(kind.code, {
        description: "The HTTP status code of the response.",
      }),
      // UnionEnum sets `default` to the first value. A response field has no
      // default, so the document must not show one.
      error: t.UnionEnum(options.errors, {
        default: undefined,
        description:
          "A code for the type of error. The code does not change, so you can use it in your code.",
      }),
      message: t.String({
        description: "A message that tells you about the error.",
        examples: options.messageExamples,
      }),
      hint: t.String({
        description: "Information that tells you how to correct the error.",
        examples: [kind.hint],
      }),
      documentationUrl: t.String({
        description: "The URL of the documentation for this type of error.",
        examples: [kind.documentationUrl],
      }),
    },
    { additionalProperties: false, description: options.description }
  );
}

export const InvalidRequestError = errorResponse({
  errors: ["invalid_request"],
  description:
    "The request is not correct. For example, a parameter has an incorrect format, or the endpoint does not use a parameter in the request.",
  messageExamples: ["Invalid request parameters"],
});

export const InvalidTimeSeriesRequestError = errorResponse({
  errors: ["invalid_request"],
  description:
    "The request is not correct. For example, a date is not in YYYY-MM-DD format, or `startDate` is after `endDate`. Refer to the endpoint description for the date rules.",
  messageExamples: [
    "Invalid request parameters",
    "Start date cannot be after end date",
  ],
});

export const InstitutionNotFoundError = errorResponse({
  errors: ["institution_not_found"],
  description: "The API did not find an institution with this ID.",
  messageExamples: ["Institution not found"],
});

export const IssuerNotFoundError = errorResponse({
  errors: ["issuer_not_found"],
  description: "The API did not find an issuer with this ID.",
  messageExamples: ["Issuer not found"],
});

const timeSeriesNotFoundDescription =
  "The API did not find data for the parameters in the request. For example, there is no snapshot for the date. Use `availableDates` to find the dates that have a snapshot.";

export const TimeSeriesNotFoundError = errorResponse({
  errors: ["no_data", "institution_not_found"],
  description: timeSeriesNotFoundDescription,
  messageExamples: [
    "No data available for date: 2025-03-01",
    "Institution not found for date: 2025-03-01",
  ],
});

export const IssuerTimeSeriesNotFoundError = errorResponse({
  errors: ["no_data", "issuer_not_found"],
  description: timeSeriesNotFoundDescription,
  messageExamples: [
    "No data available for date: 2025-03-01",
    "Issuer not found for date: 2025-03-01",
  ],
});

export const ServerError = errorResponse({
  errors: ["server_error"],
  description:
    "An error occurred on the server. Send the request again. If the error continues, refer to the `/api/v1/health` endpoint.",
  messageExamples: ["An error occurred while retrieving mortgage rates data"],
});

const dateParameterPattern = "^\\d{4}-\\d{2}-\\d{2}$";

export const TimeSeriesDateParameter = t.Object(
  {
    date: t.Optional(
      t.String({
        pattern: dateParameterPattern,
        description:
          "The date of one snapshot, in YYYY-MM-DD format (UTC). Do not use this parameter with `startDate` or `endDate`.",
        examples: ["2025-03-01"],
      })
    ),
    startDate: t.Optional(
      t.String({
        pattern: dateParameterPattern,
        description:
          "The first date of the range, in YYYY-MM-DD format (UTC). You must also send `endDate`.",
        examples: ["2025-01-01"],
      })
    ),
    endDate: t.Optional(
      t.String({
        pattern: dateParameterPattern,
        description:
          "The last date of the range, in YYYY-MM-DD format (UTC). You must also send `startDate`. This date must be on or after `startDate`.",
        examples: ["2025-03-01"],
      })
    ),
  },
  { additionalProperties: false }
);

export type TimeSeriesDateQuery = typeof TimeSeriesDateParameter.static;

export function validateTimeSeriesDateQuery(
  value: TimeSeriesDateQuery
): boolean {
  if (
    [value.date, value.startDate, value.endDate].some(
      (date) => date !== undefined && !isValidIsoDate(date)
    )
  ) {
    return false;
  }

  if (value.date && (value.startDate || value.endDate)) {
    return false;
  }

  return !(
    (value.startDate && !value.endDate) ||
    (!value.startDate && value.endDate)
  );
}

const ResponseTimestamp = t.String({
  description:
    "The date and time (UTC, ISO 8601) when the server made this response.",
  examples: ["2025-03-04T02:30:00.000Z"],
});

export const HealthResponse = t.Object(
  {
    status: t.Literal("ok", {
      description:
        "The status of the API. The value `ok` shows that the API can read its database.",
    }),
    dataSets: t.Array(
      t.Object(
        {
          dataType: t.String({
            description: "The name of the dataset.",
            examples: ["mortgage-rates"],
          }),
          lastUpdated: t.String({
            description:
              "The date and time (UTC) of the last change to this dataset, in YYYY-MM-DD HH:MM:SS format. This time does not change when the API collects the same data again.",
            examples: ["2025-03-04 01:00:00"],
          }),
          lastChecked: nullable(
            t.String({ examples: ["2025-03-05 09:00:00"] }),
            {
              description:
                "The date and time (UTC) of the last complete successful data collection for this dataset, in YYYY-MM-DD HH:MM:SS format. Partial collections do not change this time. The API collects each dataset each hour, also when the data does not change. The value is `null` if the API has no record of a collection.",
            }
          ),
          stale: nullable(t.Boolean(), {
            description:
              "The value is `true` if the API did not collect this dataset correctly in the last 3 hours. Then the data can be old. The value is `false` if the API collected the dataset in the last 3 hours. The value is `null` if `lastChecked` is `null`.",
          }),
        },
        { additionalProperties: false }
      ),
      {
        description:
          "The datasets of the API. There is one item for each type of rate.",
      }
    ),
    timestamp: ResponseTimestamp,
  },
  {
    additionalProperties: false,
    description:
      "The API can read its database. The response shows the time of the last change and the time of the last data collection for each dataset.",
  }
);

export const HealthErrorResponse = t.Object(
  {
    status: t.Literal("error", {
      description:
        "The status of the API. The value `error` shows that the API cannot read its database.",
    }),
    message: t.String({
      description: "A message that tells you about the error.",
      examples: ["Unable to read data freshness"],
    }),
    timestamp: ResponseTimestamp,
  },
  {
    additionalProperties: false,
    description: "The API cannot read its database.",
  }
);

export const TimestampedFields = {
  termsOfUse: t.String({
    description:
      "The terms of use for the data. The data can be incorrect. For correct rates, refer to the financial institution.",
  }),
  timestamp: ResponseTimestamp,
};

export function invalidRequestParameters(): ApiErrorBody {
  return apiError("invalid_request", "Invalid request parameters");
}
