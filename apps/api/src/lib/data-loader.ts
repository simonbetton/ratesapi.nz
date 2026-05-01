import { type TSchema } from "elysia";
import { type CarLoanRates } from "../models/car-loan-rates";
import { type CreditCardRates } from "../models/credit-card-rates";
import { type MortgageRates } from "../models/mortgage-rates";
import { type PersonalLoanRates } from "../models/personal-loan-rates";
import { type Database } from "./environment";
import { createLogger } from "./logging";
import { parseSchema } from "./schema";

export type SupportedModels =
  | MortgageRates
  | PersonalLoanRates
  | CarLoanRates
  | CreditCardRates;

export type DataType =
  | "mortgage-rates"
  | "car-loan-rates"
  | "credit-card-rates"
  | "personal-loan-rates";

export type LoadLatestDataOptions = {
  fallbackUrl?: string;
};

const log = createLogger("data-loader");

/**
 * Loads the latest data from D1 database
 */
export async function loadLatestData<Schema extends TSchema>(
  dataType: DataType,
  db: Database,
  schema: Schema,
  options: LoadLatestDataOptions = {},
): Promise<Schema["static"]> {
  try {
    const stmt = db.prepare("SELECT data FROM latest_data WHERE data_type = ?");
    const result = await stmt.bind(dataType).first();
    const data = readStringField(result, "data");

    if (!data) {
      throw new Error(`No data found for ${dataType}`);
    }

    log.info({ dataType }, "Loaded latest data");

    return parseSchema(schema, fromSavableJson(data));
  } catch (error) {
    if (options.fallbackUrl) {
      log.warn(
        { dataType, error, fallbackUrl: options.fallbackUrl },
        "Falling back to production API data",
      );
      return loadLatestDataFromApi(dataType, options.fallbackUrl, schema);
    }

    throw new Error(`Failed to load ${dataType} data: ${error}`);
  }
}

export function productionLatestDataFallbackUrl(
  dataType: DataType,
  environment: string | undefined,
): string | undefined {
  if (environment !== "development") {
    return undefined;
  }

  return `https://ratesapi.nz/api/v1/${dataType}`;
}

/**
 * Loads data for a specific date from the D1 database
 */
export async function loadHistoricalData<Schema extends TSchema>(
  dataType: DataType,
  date: string,
  db: Database,
  schema: Schema,
): Promise<Schema["static"] | null> {
  try {
    const stmt = db.prepare(
      "SELECT data FROM historical_data WHERE data_type = ? AND date = ?",
    );
    const result = await stmt.bind(dataType, date).first();
    const data = readStringField(result, "data");

    if (!data) {
      return null;
    }

    log.info({ dataType, date }, "Loaded historical data");

    return parseSchema(schema, fromSavableJson(data));
  } catch (error) {
    throw new Error(
      `Failed to load historical ${dataType} data for ${date}: ${error}`,
    );
  }
}

export function toSavableJson(json: unknown) {
  return btoa(JSON.stringify(json));
}

export function fromSavableJson(json: string): unknown {
  return JSON.parse(atob(json));
}

/**
 * Gets all available dates for which we have historical data
 */
export async function getAvailableDates(
  dataType: DataType,
  db: Database,
): Promise<string[]> {
  try {
    const stmt = db.prepare(
      "SELECT date FROM historical_data WHERE data_type = ? ORDER BY date ASC",
    );
    const results = await stmt.bind(dataType).all();

    return results.results
      .map((row) => readStringField(row, "date"))
      .filter((date): date is string => date !== undefined);
  } catch (error) {
    log.error({ dataType, error }, "Failed to get available dates");
    throw new Error(`Failed to get available dates for ${dataType}: ${error}`);
  }
}

/**
 * Loads data for a range of dates
 */
export async function loadTimeSeriesData<Schema extends TSchema>(
  dataType: DataType,
  startDate: string,
  endDate: string,
  db: Database,
  schema: Schema,
): Promise<Record<string, Schema["static"]>> {
  try {
    const stmt = db.prepare(
      "SELECT date, data FROM historical_data WHERE data_type = ? AND date >= ? AND date <= ? ORDER BY date ASC",
    );
    const results = await stmt.bind(dataType, startDate, endDate).all();

    const timeSeries: Record<string, Schema["static"]> = {};

    for (const row of results.results) {
      const date = readStringField(row, "date");
      const data = readStringField(row, "data");

      if (date && data) {
        timeSeries[date] = parseSchema(schema, fromSavableJson(data));
      }
    }

    return timeSeries;
  } catch (error) {
    log.error({ dataType, error }, "Failed to load time series data");
    throw new Error(
      `Failed to load time series data for ${dataType}: ${error}`,
    );
  }
}

function readStringField(
  row: Record<string, unknown> | null,
  field: string,
): string | undefined {
  const value = row?.[field];
  return typeof value === "string" ? value : undefined;
}

async function loadLatestDataFromApi<Schema extends TSchema>(
  dataType: DataType,
  url: string,
  schema: Schema,
): Promise<Schema["static"]> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Fallback request for ${dataType} failed with status ${response.status}`,
    );
  }

  const body = await response.json();
  log.info({ dataType, url }, "Loaded fallback latest data");

  return parseSchema(schema, stripApiOnlyFields(body));
}

function stripApiOnlyFields(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const model: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(value)) {
    if (key !== "termsOfUse" && key !== "timestamp") {
      model[key] = field;
    }
  }

  return model;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
