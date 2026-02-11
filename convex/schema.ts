import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const dataType = v.union(
  v.literal("mortgage-rates"),
  v.literal("personal-loan-rates"),
  v.literal("car-loan-rates"),
  v.literal("credit-card-rates"),
);

export default defineSchema({
  dailyRateAggregates: defineTable({
    aggregate: v.any(),
    dataType,
    generatedAt: v.string(),
    payloadHash: v.string(),
    snapshotDate: v.string(),
  }).index("by_data_type_and_date", ["dataType", "snapshotDate"]),

  ingestionRuns: defineTable({
    dataType,
    finishedAt: v.optional(v.string()),
    payloadHash: v.optional(v.string()),
    reason: v.optional(v.string()),
    snapshotDate: v.string(),
    startedAt: v.string(),
    status: v.union(
      v.literal("failed"),
      v.literal("skipped"),
      v.literal("success"),
    ),
  }).index("by_data_type_and_started_at", ["dataType", "startedAt"]),

  latestRateData: defineTable({
    dataType,
    modelType: v.string(),
    payload: v.any(),
    payloadHash: v.string(),
    recordCount: v.number(),
    scrapedAt: v.string(),
    snapshotDate: v.string(),
    sourceLastUpdated: v.string(),
    updatedAt: v.string(),
  }).index("by_data_type", ["dataType"]),

  rateSnapshots: defineTable({
    dataType,
    modelType: v.string(),
    payload: v.any(),
    payloadHash: v.string(),
    recordCount: v.number(),
    scrapedAt: v.string(),
    snapshotDate: v.string(),
    sourceLastUpdated: v.string(),
  })
    .index("by_data_type_and_date", ["dataType", "snapshotDate"])
    .index("by_data_type_and_scraped_at", ["dataType", "scrapedAt"]),
});
