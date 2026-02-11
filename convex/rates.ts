import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const dataType = v.union(
  v.literal("mortgage-rates"),
  v.literal("personal-loan-rates"),
  v.literal("car-loan-rates"),
  v.literal("credit-card-rates"),
);

export const getAvailableDates = queryGeneric({
  args: {
    dataType,
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("rateSnapshots")
      .withIndex("by_data_type_and_date", (q) => q.eq("dataType", args.dataType))
      .collect();

    const dates = rows.map((row) => String(row.snapshotDate));

    return Array.from(new Set(dates)).sort((a, b) => a.localeCompare(b));
  },
});

export const getAggregateByDate = queryGeneric({
  args: {
    dataType,
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("dailyRateAggregates")
      .withIndex("by_data_type_and_date", (q) => q.eq("dataType", args.dataType))
      .collect();
    const row = rows.find((candidate) => candidate.snapshotDate === args.date);

    return row?.aggregate ?? null;
  },
});

export const getAggregateTimeSeries = queryGeneric({
  args: {
    dataType,
    endDate: v.string(),
    startDate: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("dailyRateAggregates")
      .withIndex("by_data_type_and_date", (q) => q.eq("dataType", args.dataType))
      .collect();

    const output: Record<string, unknown> = {};

    for (const row of rows) {
      if (isInDateRange(row.snapshotDate, args.startDate, args.endDate)) {
        output[row.snapshotDate] = row.aggregate;
      }
    }

    return output;
  },
});

export const getHistoricalByDate = queryGeneric({
  args: {
    dataType,
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("rateSnapshots")
      .withIndex("by_data_type_and_date", (q) => q.eq("dataType", args.dataType))
      .collect();
    const row = rows.find((candidate) => candidate.snapshotDate === args.date);

    return row?.payload ?? null;
  },
});

export const getLatestByDataType = queryGeneric({
  args: {
    dataType,
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("latestRateData")
      .withIndex("by_data_type", (q) => q.eq("dataType", args.dataType))
      .collect();

    if (rows.length === 0) {
      return null;
    }

    const [latest] = sortLatestRows(rows);

    return latest?.payload ?? null;
  },
});

export const getTimeSeries = queryGeneric({
  args: {
    dataType,
    endDate: v.string(),
    startDate: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("rateSnapshots")
      .withIndex("by_data_type_and_date", (q) => q.eq("dataType", args.dataType))
      .collect();

    const output: Record<string, unknown> = {};

    for (const row of rows) {
      if (isInDateRange(row.snapshotDate, args.startDate, args.endDate)) {
        output[row.snapshotDate] = row.payload;
      }
    }

    return output;
  },
});

export const upsertSnapshot = mutationGeneric({
  args: {
    aggregate: v.optional(v.any()),
    dataType,
    ingestSecret: v.string(),
    modelType: v.string(),
    payload: v.any(),
    payloadHash: v.string(),
    recordCount: v.number(),
    scrapedAt: v.string(),
    snapshotDate: v.string(),
    sourceLastUpdated: v.string(),
  },
  handler: async (ctx, args) => {
    assertIngestSecret(args.ingestSecret);

    const now = new Date().toISOString();

    const existingSnapshot = await ctx.db
      .query("rateSnapshots")
      .withIndex("by_data_type_and_date", (q) => q.eq("dataType", args.dataType))
      .collect()
      .then((rows) =>
        rows.find((candidate) => candidate.snapshotDate === args.snapshotDate),
      );

    if (existingSnapshot) {
      await ctx.db.patch(existingSnapshot._id, {
        modelType: args.modelType,
        payload: args.payload,
        payloadHash: args.payloadHash,
        recordCount: args.recordCount,
        scrapedAt: args.scrapedAt,
        sourceLastUpdated: args.sourceLastUpdated,
      });
    } else {
      await ctx.db.insert("rateSnapshots", {
        dataType: args.dataType,
        modelType: args.modelType,
        payload: args.payload,
        payloadHash: args.payloadHash,
        recordCount: args.recordCount,
        scrapedAt: args.scrapedAt,
        snapshotDate: args.snapshotDate,
        sourceLastUpdated: args.sourceLastUpdated,
      });
    }

    if (args.aggregate !== undefined) {
      const existingAggregate = await ctx.db
        .query("dailyRateAggregates")
        .withIndex("by_data_type_and_date", (q) => q.eq("dataType", args.dataType))
        .collect()
        .then((rows) =>
          rows.find((candidate) => candidate.snapshotDate === args.snapshotDate),
        );

      if (existingAggregate) {
        await ctx.db.patch(existingAggregate._id, {
          aggregate: args.aggregate,
          generatedAt: now,
          payloadHash: args.payloadHash,
        });
      } else {
        await ctx.db.insert("dailyRateAggregates", {
          aggregate: args.aggregate,
          dataType: args.dataType,
          generatedAt: now,
          payloadHash: args.payloadHash,
          snapshotDate: args.snapshotDate,
        });
      }
    }

    const latestRows = sortLatestRows(
      await ctx.db
        .query("latestRateData")
        .withIndex("by_data_type", (q) => q.eq("dataType", args.dataType))
        .collect(),
    );

    const currentLatest = latestRows[0];
    const shouldUpdateLatest =
      !currentLatest ||
      compareSnapshots(
        args.snapshotDate,
        args.scrapedAt,
        currentLatest.snapshotDate,
        currentLatest.scrapedAt,
      ) >= 0;

    if (currentLatest && shouldUpdateLatest) {
      await ctx.db.patch(currentLatest._id, {
        modelType: args.modelType,
        payload: args.payload,
        payloadHash: args.payloadHash,
        recordCount: args.recordCount,
        scrapedAt: args.scrapedAt,
        snapshotDate: args.snapshotDate,
        sourceLastUpdated: args.sourceLastUpdated,
        updatedAt: now,
      });
    } else if (!currentLatest) {
      await ctx.db.insert("latestRateData", {
        dataType: args.dataType,
        modelType: args.modelType,
        payload: args.payload,
        payloadHash: args.payloadHash,
        recordCount: args.recordCount,
        scrapedAt: args.scrapedAt,
        snapshotDate: args.snapshotDate,
        sourceLastUpdated: args.sourceLastUpdated,
        updatedAt: now,
      });
    }

    if (latestRows.length > 1) {
      for (const duplicateLatest of latestRows.slice(1)) {
        await ctx.db.delete(duplicateLatest._id);
      }
    }

    await ctx.db.insert("ingestionRuns", {
      dataType: args.dataType,
      finishedAt: now,
      payloadHash: args.payloadHash,
      snapshotDate: args.snapshotDate,
      startedAt: args.scrapedAt,
      status: "success",
    });

    return {
      latestUpdated: shouldUpdateLatest,
      snapshotDate: args.snapshotDate,
      status: "ok",
    };
  },
});

function assertIngestSecret(candidate: string) {
  const expected = process.env.CONVEX_INGEST_SECRET;

  if (!expected) {
    throw new Error("CONVEX_INGEST_SECRET is not configured in Convex");
  }

  if (candidate !== expected) {
    throw new Error("Invalid ingest secret");
  }
}

function compareSnapshots(
  leftDate: string,
  leftScrapedAt: string,
  rightDate: string,
  rightScrapedAt: string,
): number {
  if (leftDate !== rightDate) {
    return leftDate.localeCompare(rightDate);
  }

  return leftScrapedAt.localeCompare(rightScrapedAt);
}

function sortLatestRows<
  TRow extends {
    scrapedAt: string;
    snapshotDate: string;
  },
>(rows: TRow[]): TRow[] {
  return [...rows].sort((left, right) =>
    compareSnapshots(
      right.snapshotDate,
      right.scrapedAt,
      left.snapshotDate,
      left.scrapedAt,
    ),
  );
}

function isInDateRange(date: string, startDate: string, endDate: string): boolean {
  return date >= startDate && date <= endDate;
}
