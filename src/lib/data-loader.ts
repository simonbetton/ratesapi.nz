import type { CarLoanRates } from "../models/car-loan-rates";
import type { CreditCardRates } from "../models/credit-card-rates";
import type { MortgageRates } from "../models/mortgage-rates";
import type { PersonalLoanRates } from "../models/personal-loan-rates";
import { createConvexClient } from "./convex-client";
import { CONVEX_FUNCTIONS } from "./convex-functions";
import type { DataType } from "./data-types";
import {
  isDailyAggregate,
  isDailyAggregateRecord,
  type DailyAggregate,
} from "./rate-aggregates";
import {
  parseModelByDataType,
  parseModelRecordByDataType,
  type SupportedRatesModel,
} from "./rates-models";

export class NoDataFoundError extends Error {
  dataType: DataType;

  constructor(dataType: DataType) {
    super(`No data found for ${dataType}`);
    this.name = "NoDataFoundError";
    this.dataType = dataType;
  }
}

/**
 * Loads the latest data from Convex.
 */
export async function loadLatestData(dataType: "mortgage-rates"): Promise<MortgageRates>;
export async function loadLatestData(
  dataType: "personal-loan-rates",
): Promise<PersonalLoanRates>;
export async function loadLatestData(dataType: "car-loan-rates"): Promise<CarLoanRates>;
export async function loadLatestData(
  dataType: "credit-card-rates",
): Promise<CreditCardRates>;
export async function loadLatestData(dataType: DataType): Promise<SupportedRatesModel> {
  try {
    const client = createConvexClient();
    const result = await client.query(CONVEX_FUNCTIONS.getLatestByDataType, {
      dataType,
    });

    if (!result) {
      throw new NoDataFoundError(dataType);
    }

    return parseModelByDataType(dataType, result);
  } catch (error) {
    if (error instanceof NoDataFoundError) {
      throw error;
    }

    throw new Error(`Failed to load ${dataType} data: ${error}`);
  }
}

/**
 * Loads data for a specific date from Convex.
 */
export async function loadHistoricalData(
  dataType: "mortgage-rates",
  date: string,
): Promise<MortgageRates | null>;
export async function loadHistoricalData(
  dataType: "personal-loan-rates",
  date: string,
): Promise<PersonalLoanRates | null>;
export async function loadHistoricalData(
  dataType: "car-loan-rates",
  date: string,
): Promise<CarLoanRates | null>;
export async function loadHistoricalData(
  dataType: "credit-card-rates",
  date: string,
): Promise<CreditCardRates | null>;
export async function loadHistoricalData(
  dataType: DataType,
  date: string,
): Promise<SupportedRatesModel | null> {
  try {
    const client = createConvexClient();
    const result = await client.query(CONVEX_FUNCTIONS.getHistoricalByDate, {
      dataType,
      date,
    });

    if (!result) {
      return null;
    }

    return parseModelByDataType(dataType, result);
  } catch (error) {
    throw new Error(`Failed to load historical ${dataType} data for ${date}: ${error}`);
  }
}

/**
 * Gets all available dates for which we have historical data.
 */
export async function getAvailableDates(dataType: DataType): Promise<string[]> {
  try {
    const client = createConvexClient();
    const result = await client.query(CONVEX_FUNCTIONS.getAvailableDates, {
      dataType,
    });

    if (!Array.isArray(result)) {
      throw new Error("Invalid available dates response from Convex");
    }

    if (!result.every(isString)) {
      throw new Error("Invalid available dates payload: expected string[]");
    }

    return result;
  } catch (error) {
    console.error(`Failed to get available dates for ${dataType}:`, error);
    return [];
  }
}

/**
 * Loads data for a range of dates.
 */
export async function loadTimeSeriesData(
  dataType: "mortgage-rates",
  startDate: string,
  endDate: string,
): Promise<Record<string, MortgageRates>>;
export async function loadTimeSeriesData(
  dataType: "personal-loan-rates",
  startDate: string,
  endDate: string,
): Promise<Record<string, PersonalLoanRates>>;
export async function loadTimeSeriesData(
  dataType: "car-loan-rates",
  startDate: string,
  endDate: string,
): Promise<Record<string, CarLoanRates>>;
export async function loadTimeSeriesData(
  dataType: "credit-card-rates",
  startDate: string,
  endDate: string,
): Promise<Record<string, CreditCardRates>>;
export async function loadTimeSeriesData(
  dataType: DataType,
  startDate: string,
  endDate: string,
): Promise<Record<string, SupportedRatesModel>> {
  try {
    const client = createConvexClient();
    const result = await client.query(CONVEX_FUNCTIONS.getTimeSeries, {
      dataType,
      endDate,
      startDate,
    });

    if (!result) {
      return {};
    }

    return parseModelRecordByDataType(dataType, result);
  } catch (error) {
    console.error(`Failed to load time series data for ${dataType}:`, error);
    return {};
  }
}

/**
 * Loads a daily aggregate snapshot for a given date.
 */
export async function loadAggregateByDate(
  dataType: DataType,
  date: string,
): Promise<DailyAggregate | null> {
  try {
    const client = createConvexClient();
    const result = await client.query(CONVEX_FUNCTIONS.getAggregateByDate, {
      dataType,
      date,
    });

    if (!result) {
      return null;
    }

    if (!isDailyAggregate(result)) {
      throw new Error("Invalid aggregate payload returned by Convex");
    }

    return result;
  } catch (error) {
    console.error(`Failed to load aggregate data for ${dataType} on ${date}:`, error);
    return null;
  }
}

/**
 * Loads aggregate data for a range of dates.
 */
export async function loadAggregateTimeSeries(
  dataType: DataType,
  startDate: string,
  endDate: string,
): Promise<Record<string, DailyAggregate>> {
  try {
    const client = createConvexClient();
    const result = await client.query(CONVEX_FUNCTIONS.getAggregateTimeSeries, {
      dataType,
      endDate,
      startDate,
    });

    if (!result) {
      return {};
    }

    if (!isDailyAggregateRecord(result)) {
      throw new Error("Invalid aggregate timeseries payload returned by Convex");
    }

    return result;
  } catch (error) {
    console.error(`Failed to load aggregate time series for ${dataType}:`, error);
    return {};
  }
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
