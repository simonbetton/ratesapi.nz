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

function errorResponse(
  code: 400 | 404 | 500,
  description: string,
  messageExamples: string[]
) {
  return t.Object(
    {
      code: t.Literal(code, {
        description: "The HTTP status code of the response.",
      }),
      message: t.String({
        description: "A message that tells you about the error.",
        examples: messageExamples,
      }),
    },
    { additionalProperties: false, description }
  );
}

export const InvalidRequestError = errorResponse(
  400,
  "The request is not correct. For example, a parameter has an incorrect format, or the endpoint does not use a parameter in the request.",
  ["Invalid request parameters"]
);

export const InvalidTimeSeriesRequestError = errorResponse(
  400,
  "The request is not correct. For example, a date is not in YYYY-MM-DD format, or `startDate` is after `endDate`. Refer to the endpoint description for the date rules.",
  ["Invalid request parameters", "Start date cannot be after end date"]
);

export const InstitutionNotFoundError = errorResponse(
  404,
  "The API did not find an institution with this ID.",
  ["Institution not found"]
);

export const IssuerNotFoundError = errorResponse(
  404,
  "The API did not find an issuer with this ID.",
  ["Issuer not found"]
);

export const TimeSeriesNotFoundError = errorResponse(
  404,
  "The API did not find data for the parameters in the request. For example, there is no snapshot for the date. Use `availableDates` to find the dates that have a snapshot.",
  [
    "No data available for date: 2025-03-01",
    "Institution not found for date: 2025-03-01",
  ]
);

export const ServerError = errorResponse(
  500,
  "An error occurred on the server. Send the request again. If the error continues, refer to the `/api/v1/health` endpoint.",
  ["An error occurred while retrieving mortgage rates data"]
);

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
                "The date and time (UTC) of the last correct data collection for this dataset, in YYYY-MM-DD HH:MM:SS format. The API collects each dataset each hour, also when the data does not change. The value is `null` if the API has no record of a collection.",
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

export interface ValidationErrorResponseBody {
  code: 400;
  message: "Invalid request parameters";
}

export const ValidationErrorResponse: ValidationErrorResponseBody = {
  code: 400,
  message: "Invalid request parameters",
};

export function invalidRequestParameters() {
  return ValidationErrorResponse;
}
