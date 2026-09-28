import type { TSchema } from "elysia";

import { entityNotFoundError, timeSeriesErrors } from "../models/api";
import type { ApiErrorBody } from "../models/api";
import {
  getAvailableDates,
  loadHistoricalData,
  loadTimeSeriesData,
} from "./data-loader";
import type { DataType, SupportedModels } from "./data-loader";
import type { Database } from "./environment";
import { termsOfUse } from "./terms-of-use";
import { getCurrentTimestamp } from "./transforms";

export type EntityRates = SupportedModels & {
  data: { id: string }[];
};

export type EntityName = "institution" | "issuer";

export interface TimeSeriesBody<
  T extends EntityRates,
  ResponseType extends string,
> {
  type: ResponseType;
  timeSeries: Record<string, T>;
  availableDates: string[];
  termsOfUse: ReturnType<typeof termsOfUse>;
  timestamp: string;
  message?: string;
}

export type EntityTimeSeriesResult<
  T extends EntityRates,
  ResponseType extends string,
> =
  | { ok: true; body: TimeSeriesBody<T, ResponseType> }
  | {
      ok: false;
      status: ApiErrorBody["code"];
      body: ApiErrorBody;
    };

export type EntitySchema<T extends EntityRates> = TSchema & {
  static: T;
};

export interface EntityTimeSeriesOptions<
  T extends EntityRates,
  ResponseType extends string,
> {
  dataType: DataType;
  schema: EntitySchema<T>;
  responseType: ResponseType;
  entityName: EntityName;
  entityId?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  db: Database;
}

export async function getEntityTimeSeries<
  T extends EntityRates,
  ResponseType extends string,
>(
  options: EntityTimeSeriesOptions<T, ResponseType>
): Promise<EntityTimeSeriesResult<T, ResponseType>> {
  const availableDates = await getAvailableDates(options.dataType, options.db);

  if (availableDates.length === 0) {
    return errorResult<T, ResponseType>(
      timeSeriesErrors.noSnapshots(listPath(options.dataType))
    );
  }

  if (options.date) {
    return getSingleDateTimeSeries<T, ResponseType>(
      options,
      availableDates,
      options.date
    );
  }

  if (options.startDate && options.endDate) {
    return getDateRangeTimeSeries<T, ResponseType>(
      options,
      availableDates,
      options.startDate,
      options.endDate
    );
  }

  return successResult<T, ResponseType>(
    options.responseType,
    {},
    availableDates,
    {
      message:
        "Please specify a date or date range to retrieve time series data",
    }
  );
}

async function getSingleDateTimeSeries<
  T extends EntityRates,
  ResponseType extends string,
>(
  options: EntityTimeSeriesOptions<T, ResponseType>,
  availableDates: string[],
  date: string
): Promise<EntityTimeSeriesResult<T, ResponseType>> {
  const historicalData = await loadHistoricalData(
    options.dataType,
    date,
    options.db,
    options.schema
  );

  if (!historicalData) {
    return errorResult<T, ResponseType>(
      timeSeriesErrors.noSnapshotForDate(date)
    );
  }

  const filteredData = filterDataByEntityId(historicalData, options.entityId);

  if (options.entityId && filteredData.data.length === 0) {
    return errorResult<T, ResponseType>(
      entityNotFoundError(
        options.entityName,
        `${listPath(options.dataType)}/time-series?date=${date}`,
        `${toTitleCase(options.entityName)} not found for date: ${date}`
      )
    );
  }

  return successResult<T, ResponseType>(
    options.responseType,
    { [date]: filteredData },
    availableDates
  );
}

async function getDateRangeTimeSeries<
  T extends EntityRates,
  ResponseType extends string,
>(
  options: EntityTimeSeriesOptions<T, ResponseType>,
  availableDates: string[],
  startDate: string,
  endDate: string
): Promise<EntityTimeSeriesResult<T, ResponseType>> {
  if (startDate > endDate) {
    return errorResult<T, ResponseType>(timeSeriesErrors.startAfterEnd());
  }

  const timeSeriesData = await loadTimeSeriesData(
    options.dataType,
    startDate,
    endDate,
    options.db,
    options.schema
  );

  if (Object.keys(timeSeriesData).length === 0) {
    return errorResult<T, ResponseType>(
      timeSeriesErrors.noSnapshotInRange(startDate, endDate)
    );
  }

  const filteredTimeSeries = filterTimeSeriesByEntityId(
    timeSeriesData,
    options.entityId
  );

  if (options.entityId && Object.keys(filteredTimeSeries).length === 0) {
    return errorResult<T, ResponseType>(
      entityNotFoundError(
        options.entityName,
        listPath(options.dataType),
        `No data found matching the specified ${options.entityName}`
      )
    );
  }

  return successResult<T, ResponseType>(
    options.responseType,
    filteredTimeSeries,
    availableDates
  );
}

function filterTimeSeriesByEntityId<T extends EntityRates>(
  timeSeriesData: Record<string, T>,
  entityId?: string
): Record<string, T> {
  if (!entityId) {
    return timeSeriesData;
  }

  const filteredTimeSeries: Record<string, T> = {};

  for (const [date, data] of Object.entries(timeSeriesData)) {
    const filteredData = filterDataByEntityId(data, entityId);

    if (filteredData.data.length > 0) {
      filteredTimeSeries[date] = filteredData;
    }
  }

  return filteredTimeSeries;
}

function filterDataByEntityId<T extends EntityRates>(
  data: T,
  entityId?: string
): T {
  if (!entityId) {
    return data;
  }

  const normalizedEntityId = entityId.toLowerCase();
  const filteredData = structuredClone(data);
  const filteredEntities = data.data.filter(
    (entity) => entity.id.toLowerCase() === normalizedEntityId
  );

  filteredData.data.length = 0;
  filteredData.data.push(...filteredEntities);

  return filteredData;
}

function successResult<T extends EntityRates, ResponseType extends string>(
  type: ResponseType,
  timeSeries: Record<string, T>,
  availableDates: string[],
  options: { message?: string } = {}
): EntityTimeSeriesResult<T, ResponseType> {
  return {
    ok: true,
    body: {
      type,
      timeSeries,
      availableDates,
      termsOfUse: termsOfUse(),
      timestamp: getCurrentTimestamp(),
      ...options,
    },
  };
}

function errorResult<T extends EntityRates, ResponseType extends string>(
  body: ApiErrorBody
): EntityTimeSeriesResult<T, ResponseType> {
  return { ok: false, status: body.code, body };
}

// The list endpoint of a dataset, for example /api/v1/personal-loan-rates.
function listPath(dataType: DataType): string {
  return `/api/v1/${dataType}`;
}

function toTitleCase(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
