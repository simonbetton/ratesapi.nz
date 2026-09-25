import { t } from "elysia";
import type { TSchema } from "elysia";

import { TimestampedFields } from "./api";
import { CarLoanRates } from "./car-loan-rates";
import { CreditCardRates } from "./credit-card-rates";
import { MortgageRates } from "./mortgage-rates";
import { PersonalLoanRates } from "./personal-loan-rates";

export const MortgageRatesResponse = t.Object(
  {
    ...MortgageRates.properties,
    ...TimestampedFields,
  },
  {
    additionalProperties: false,
    description: "The newest mortgage rates.",
  }
);

export const PersonalLoanRatesResponse = t.Object(
  {
    ...PersonalLoanRates.properties,
    ...TimestampedFields,
  },
  {
    additionalProperties: false,
    description: "The newest personal loan rates.",
  }
);

export const CarLoanRatesResponse = t.Object(
  {
    ...CarLoanRates.properties,
    ...TimestampedFields,
  },
  {
    additionalProperties: false,
    description: "The newest car loan rates.",
  }
);

export const CreditCardRatesResponse = t.Object(
  {
    ...CreditCardRates.properties,
    ...TimestampedFields,
  },
  {
    additionalProperties: false,
    description: "The newest credit card rates and fees.",
  }
);

function timeSeriesResponse<Type extends string, Snapshot extends TSchema>(
  type: Type,
  snapshot: Snapshot
) {
  return t.Object(
    {
      type: t.Literal(type, {
        description: `The type of data. The value is always \`${type}\`.`,
      }),
      timeSeries: t.Record(t.String(), snapshot, {
        description:
          "The snapshots. Each key is a snapshot date in YYYY-MM-DD format. Each value contains the data for that date.",
      }),
      availableDates: t.Array(
        t.String({
          examples: ["2025-03-01"],
        }),
        {
          description:
            "All dates that have a snapshot, in YYYY-MM-DD format. The list starts with the oldest date.",
        }
      ),
      ...TimestampedFields,
      message: t.Optional(
        t.String({
          description:
            "A message that tells you how to use this endpoint. The response contains this field only when the request has no dates.",
          examples: [
            "Please specify a date or date range to retrieve time series data",
          ],
        })
      ),
    },
    {
      additionalProperties: false,
      description:
        "The snapshots for the dates in the request. If the request has no dates, `timeSeries` is empty and `availableDates` shows the dates that you can request.",
    }
  );
}

export const MortgageRatesTimeSeriesResponse = timeSeriesResponse(
  "MortgageRatesTimeSeries",
  MortgageRates
);

export const PersonalLoanRatesTimeSeriesResponse = timeSeriesResponse(
  "PersonalLoanRatesTimeSeries",
  PersonalLoanRates
);

export const CarLoanRatesTimeSeriesResponse = timeSeriesResponse(
  "CarLoanRatesTimeSeries",
  CarLoanRates
);

export const CreditCardRatesTimeSeriesResponse = timeSeriesResponse(
  "CreditCardRatesTimeSeries",
  CreditCardRates
);
