import { D1Database } from '@cloudflare/workers-types';
import { CarLoanRates } from "../models/car-loan-rates";
import { CreditCardRates } from "../models/credit-card-rates";
import { MortgageRates } from "../models/mortgage-rates";
import { PersonalLoanRates } from "../models/personal-loan-rates";

type SupportedModels =
  | MortgageRates
  | PersonalLoanRates
  | CarLoanRates
  | CreditCardRates;

type DataType = "mortgage-rates" | "car-loan-rates" | "credit-card-rates" | "personal-loan-rates";

/**
 * Loads the latest data from D1 database
 */
export async function loadLatestData<T extends SupportedModels>(
  dataType: DataType,
  db: D1Database
): Promise<T> {
  try {
    const stmt = db.prepare('SELECT data FROM latest_data WHERE data_type = ?');
    const result = await stmt.bind(dataType).first<{ data: string }>();

    if (!result) {
      throw new Error(`No data found for ${dataType}`);
    }

    console.log('Loaded latest data for', dataType);

    return fromSavableJson(result.data) as T;
  } catch (error) {
    throw new Error(`Failed to load ${dataType} data: ${error}`);
  }
}

/**
 * Loads data for a specific date from the D1 database
 */
export async function loadHistoricalData<T extends SupportedModels>(
  dataType: DataType,
  date: string,
  db: D1Database
): Promise<T | null> {
  try {
    const stmt = db.prepare('SELECT data FROM historical_data WHERE data_type = ? AND date = ?');
    const result = await stmt.bind(dataType, date).first<{ data: string }>();

    if (!result) {
      return null;
    }

    console.log('Loaded historical data for', dataType, date);

    return fromSavableJson(result.data) as T;
  } catch (error) {
    throw new Error(`Failed to load historical ${dataType} data for ${date}: ${error}`);
  }
}

export function toSavableJson(json: Record<string, any>) {
  return btoa(JSON.stringify(json));
}

export function fromSavableJson(json: string) {
  return JSON.parse(atob(json));
}

/**
 * Gets all available dates for which we have historical data
 */
export async function getAvailableDates(
  dataType: DataType,
  db: D1Database
): Promise<string[]> {
  try {
    const stmt = db.prepare('SELECT date FROM historical_data WHERE data_type = ? ORDER BY date ASC');
    const results = await stmt.bind(dataType).all<{ date: string }>();

    return results.results.map(row => row.date);
  } catch (error) {
    console.error(`Failed to get available dates for ${dataType}:`, error);
    return [];
  }
}

/**
 * Loads data for a range of dates
 */
export async function loadTimeSeriesData<T extends SupportedModels>(
  dataType: DataType,
  startDate: string,
  endDate: string,
  db: D1Database
): Promise<Record<string, T>> {
  try {
    const stmt = db.prepare(
      'SELECT date, data FROM historical_data WHERE data_type = ? AND date >= ? AND date <= ? ORDER BY date ASC'
    );
    const results = await stmt.bind(dataType, startDate, endDate).all<{ date: string, data: string }>();

    const timeSeries: Record<string, T> = {};

    for (const row of results.results) {
      timeSeries[row.date] = fromSavableJson(row.data) as T;
    }

    return timeSeries;
  } catch (error) {
    console.error(`Failed to load time series data for ${dataType}:`, error);
    return {};
  }
}

/**
 * Save historical data to the D1 database
 */
export async function saveHistoricalData<T extends SupportedModels>(
  dataType: DataType,
  date: string,
  data: T,
  db: D1Database
): Promise<void> {
  try {
    const dataJson = toSavableJson(data);

    // Insert or replace historical data
    const stmt = db.prepare(
      'INSERT OR REPLACE INTO historical_data (data_type, date, data) VALUES (?, ?, ?)'
    );
    await stmt.bind(dataType, date, dataJson).run();

    // Also update latest_data
    const latestStmt = db.prepare(
      'INSERT OR REPLACE INTO latest_data (data_type, data, last_updated) VALUES (?, ?, CURRENT_TIMESTAMP)'
    );
    await latestStmt.bind(dataType, dataJson).run();
  } catch (error) {
    throw new Error(`Failed to save historical data for ${dataType} on ${date}: ${error}`);
  }
}
