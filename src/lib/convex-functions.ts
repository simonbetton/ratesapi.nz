import { makeFunctionReference } from "convex/server";

export const CONVEX_FUNCTIONS = {
  getAggregateByDate: makeFunctionReference<"query">("rates:getAggregateByDate"),
  getAggregateTimeSeries: makeFunctionReference<"query">(
    "rates:getAggregateTimeSeries",
  ),
  getAvailableDates: makeFunctionReference<"query">("rates:getAvailableDates"),
  getHistoricalByDate: makeFunctionReference<"query">("rates:getHistoricalByDate"),
  getLatestByDataType: makeFunctionReference<"query">(
    "rates:getLatestByDataType",
  ),
  getTimeSeries: makeFunctionReference<"query">("rates:getTimeSeries"),
  upsertSnapshot: makeFunctionReference<"mutation">("rates:upsertSnapshot"),
};
