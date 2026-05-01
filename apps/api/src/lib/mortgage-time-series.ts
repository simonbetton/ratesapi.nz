import { MortgageRates } from "../models/mortgage-rates";
import {
  getAvailableDates,
  loadHistoricalData,
  loadTimeSeriesData,
} from "./data-loader";
import { type Database } from "./environment";
import { termsOfUse } from "./terms-of-use";
import { getCurrentTimestamp } from "./transforms";

export type MortgageTimeSeriesOptions = {
  date?: string;
  startDate?: string;
  endDate?: string;
  institutionId?: string;
  termInMonths?: string;
  db: Database;
};

type MortgageFilters = Pick<
  MortgageTimeSeriesOptions,
  "institutionId" | "termInMonths"
>;

export type MortgageTimeSeriesBody = {
  type: "MortgageRatesTimeSeries";
  timeSeries: Record<string, MortgageRates>;
  availableDates: string[];
  termsOfUse: ReturnType<typeof termsOfUse>;
  timestamp: string;
  message?: string;
};

export type MortgageTimeSeriesErrorStatus = 400 | 404;

export type MortgageTimeSeriesErrorBody = {
  code: MortgageTimeSeriesErrorStatus;
  message: string;
};

export type MortgageTimeSeriesResult =
  | { ok: true; body: MortgageTimeSeriesBody }
  | {
      ok: false;
      status: MortgageTimeSeriesErrorStatus;
      body: MortgageTimeSeriesErrorBody;
    };

export async function getMortgageTimeSeries(
  options: MortgageTimeSeriesOptions,
): Promise<MortgageTimeSeriesResult> {
  const availableDates = await getAvailableDates("mortgage-rates", options.db);

  if (availableDates.length === 0) {
    return errorResult(404, "No historical data available");
  }

  if (options.date) {
    return getSingleDateTimeSeries(options, availableDates, options.date);
  }

  if (options.startDate && options.endDate) {
    return getDateRangeTimeSeries(
      options,
      availableDates,
      options.startDate,
      options.endDate,
    );
  }

  return successResult({}, availableDates, {
    message: "Please specify a date or date range to retrieve time series data",
  });
}

async function getSingleDateTimeSeries(
  options: MortgageTimeSeriesOptions,
  availableDates: string[],
  date: string,
): Promise<MortgageTimeSeriesResult> {
  const historicalData = await loadHistoricalData(
    "mortgage-rates",
    date,
    options.db,
    MortgageRates,
  );

  if (!historicalData) {
    return errorResult(404, `No data available for date: ${date}`);
  }

  const filteredData = filterMortgageRates(historicalData, options);
  const filterError = getSingleDateFilterError(filteredData, options, date);

  if (filterError) {
    return filterError;
  }

  return successResult({ [date]: filteredData }, availableDates);
}

async function getDateRangeTimeSeries(
  options: MortgageTimeSeriesOptions,
  availableDates: string[],
  startDate: string,
  endDate: string,
): Promise<MortgageTimeSeriesResult> {
  if (startDate > endDate) {
    return errorResult(400, "Start date cannot be after end date");
  }

  const timeSeriesData = await loadTimeSeriesData(
    "mortgage-rates",
    startDate,
    endDate,
    options.db,
    MortgageRates,
  );

  if (Object.keys(timeSeriesData).length === 0) {
    return errorResult(
      404,
      `No data available between ${startDate} and ${endDate}`,
    );
  }

  const timeSeries = hasFilters(options)
    ? filterMortgageTimeSeries(timeSeriesData, options)
    : timeSeriesData;

  if (hasFilters(options) && Object.keys(timeSeries).length === 0) {
    return errorResult(404, "No data found matching the specified filters");
  }

  return successResult(timeSeries, availableDates);
}

function filterMortgageTimeSeries(
  timeSeriesData: Record<string, MortgageRates>,
  filters: MortgageFilters,
): Record<string, MortgageRates> {
  const filteredTimeSeries: Record<string, MortgageRates> = {};

  for (const [date, data] of Object.entries(timeSeriesData)) {
    const filteredData = filterMortgageRates(data, filters);

    if (hasRangeMatch(filteredData, filters)) {
      filteredTimeSeries[date] = filteredData;
    }
  }

  return filteredTimeSeries;
}

function filterMortgageRates(
  data: MortgageRates,
  filters: MortgageFilters,
): MortgageRates {
  const institutionFilteredData = filterByInstitution(
    data,
    filters.institutionId,
  );

  return filterByTerm(institutionFilteredData, filters.termInMonths);
}

function filterByInstitution(
  data: MortgageRates,
  institutionId?: string,
): MortgageRates {
  if (!institutionId) {
    return data;
  }

  const normalizedInstitutionId = institutionId.toLowerCase();
  const filteredData = structuredClone(data);
  const filteredInstitutions = data.data.filter(
    (institution) => institution.id.toLowerCase() === normalizedInstitutionId,
  );

  filteredData.data.length = 0;
  filteredData.data.push(...filteredInstitutions);

  return filteredData;
}

function filterByTerm(
  data: MortgageRates,
  termInMonths?: string,
): MortgageRates {
  const parsedTermInMonths = parseTermInMonths(termInMonths);

  if (parsedTermInMonths === undefined) {
    return data;
  }

  const filteredData = structuredClone(data);

  for (const institution of filteredData.data) {
    for (const product of institution.products) {
      const matchingRates = product.rates.filter(
        (rate) => rate.termInMonths === parsedTermInMonths,
      );

      product.rates.length = 0;
      product.rates.push(...matchingRates);
    }

    const matchingProducts = institution.products.filter(
      (product) => product.rates.length > 0,
    );

    institution.products.length = 0;
    institution.products.push(...matchingProducts);
  }

  return filteredData;
}

function getSingleDateFilterError(
  data: MortgageRates,
  filters: MortgageFilters,
  date: string,
): MortgageTimeSeriesResult | null {
  if (filters.institutionId && data.data.length === 0) {
    return errorResult(404, `Institution not found for date: ${date}`);
  }

  if (filters.termInMonths && !hasMortgageRates(data)) {
    return errorResult(
      404,
      `No rates found with term ${filters.termInMonths} months for date: ${date}`,
    );
  }

  return null;
}

function hasRangeMatch(data: MortgageRates, filters: MortgageFilters): boolean {
  if (filters.termInMonths) {
    return hasMortgageRates(data);
  }

  return data.data.length > 0;
}

function hasMortgageRates(data: MortgageRates): boolean {
  return data.data.some((institution) => institution.products.length > 0);
}

function hasFilters(filters: MortgageFilters): boolean {
  return Boolean(filters.institutionId || filters.termInMonths);
}

function parseTermInMonths(termInMonths?: string): number | undefined {
  return termInMonths ? parseInt(termInMonths, 10) : undefined;
}

function successResult(
  timeSeries: Record<string, MortgageRates>,
  availableDates: string[],
  options: { message?: string } = {},
): MortgageTimeSeriesResult {
  return {
    ok: true,
    body: {
      type: "MortgageRatesTimeSeries",
      timeSeries,
      availableDates,
      termsOfUse: termsOfUse(),
      timestamp: getCurrentTimestamp(),
      ...options,
    },
  };
}

function errorResult(
  status: MortgageTimeSeriesErrorStatus,
  message: string,
): MortgageTimeSeriesResult {
  return {
    ok: false,
    status,
    body: {
      code: status,
      message,
    },
  };
}
