import { t } from "elysia";

export function isValidIsoDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return false;
  }

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const TermInMonthsParameter = t.String({
  pattern: "^\\d+$",
  description: "Mortgage term in months",
});

export const GenericApiError = t.Object(
  {
    code: t.Number({
      examples: [400, 404, 500],
    }),
    message: t.String({
      examples: ["Internal Server Error"],
    }),
  },
  { additionalProperties: false },
);

export const TimeSeriesDateParameter = t.Object(
  {
    date: t.Optional(
      t.String({
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        description: "Date in YYYY-MM-DD format for historical data",
        example: "2025-03-01",
      }),
    ),
    startDate: t.Optional(
      t.String({
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        description: "Start date in YYYY-MM-DD format for time series range",
        example: "2025-01-01",
      }),
    ),
    endDate: t.Optional(
      t.String({
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        description: "End date in YYYY-MM-DD format for time series range",
        example: "2025-03-01",
      }),
    ),
  },
  { additionalProperties: false },
);

export type TimeSeriesDateQuery = typeof TimeSeriesDateParameter.static;

export function validateTimeSeriesDateQuery(
  value: TimeSeriesDateQuery,
): boolean {
  if (
    [value.date, value.startDate, value.endDate].some(
      (date) => date !== undefined && !isValidIsoDate(date),
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

export const HealthResponse = t.Object(
  {
    status: t.Literal("ok"),
    dataSets: t.Array(
      t.Object(
        {
          dataType: t.String(),
          lastUpdated: t.String(),
        },
        { additionalProperties: false },
      ),
    ),
    timestamp: t.String(),
  },
  { additionalProperties: false },
);

export const HealthErrorResponse = t.Object(
  {
    status: t.Literal("error"),
    message: t.String(),
    timestamp: t.String(),
  },
  { additionalProperties: false },
);

export const TimestampedFields = {
  termsOfUse: t.String(),
  timestamp: t.String({
    description: "Current server timestamp",
    example: "2025-03-04T02:30:00.000Z",
  }),
};

export type ValidationErrorResponseBody = {
  code: 400;
  message: "Invalid request parameters";
};

export const ValidationErrorResponse: ValidationErrorResponseBody = {
  code: 400,
  message: "Invalid request parameters",
};

export function invalidRequestParameters() {
  return ValidationErrorResponse;
}
