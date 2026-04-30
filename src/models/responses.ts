import { t } from "elysia";
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
  { additionalProperties: false },
);

export const PersonalLoanRatesResponse = t.Object(
  {
    ...PersonalLoanRates.properties,
    ...TimestampedFields,
  },
  { additionalProperties: false },
);

export const CarLoanRatesResponse = t.Object(
  {
    ...CarLoanRates.properties,
    ...TimestampedFields,
  },
  { additionalProperties: false },
);

export const CreditCardRatesResponse = t.Object(
  {
    ...CreditCardRates.properties,
    ...TimestampedFields,
  },
  { additionalProperties: false },
);

export const MortgageRatesTimeSeriesResponse = t.Object(
  {
    type: t.Literal("MortgageRatesTimeSeries"),
    timeSeries: t.Record(t.String(), MortgageRates),
    availableDates: t.Array(t.String()),
    ...TimestampedFields,
    message: t.Optional(t.String()),
  },
  { additionalProperties: false },
);

export const PersonalLoanRatesTimeSeriesResponse = t.Object(
  {
    type: t.Literal("PersonalLoanRatesTimeSeries"),
    timeSeries: t.Record(t.String(), PersonalLoanRates),
    availableDates: t.Array(t.String()),
    ...TimestampedFields,
    message: t.Optional(t.String()),
  },
  { additionalProperties: false },
);

export const CarLoanRatesTimeSeriesResponse = t.Object(
  {
    type: t.Literal("CarLoanRatesTimeSeries"),
    timeSeries: t.Record(t.String(), CarLoanRates),
    availableDates: t.Array(t.String()),
    ...TimestampedFields,
    message: t.Optional(t.String()),
  },
  { additionalProperties: false },
);

export const CreditCardRatesTimeSeriesResponse = t.Object(
  {
    type: t.Literal("CreditCardRatesTimeSeries"),
    timeSeries: t.Record(t.String(), CreditCardRates),
    availableDates: t.Array(t.String()),
    ...TimestampedFields,
    message: t.Optional(t.String()),
  },
  { additionalProperties: false },
);
