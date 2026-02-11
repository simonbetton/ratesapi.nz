import ora from "ora";

import { createConvexClient } from "../src/lib/convex-client";
import { CONVEX_FUNCTIONS } from "../src/lib/convex-functions";
import { type DataType, modelTypeForDataType } from "../src/lib/data-types";
import { hashJson } from "../src/lib/hash";
import {
  computeDailyAggregate,
  type DailyAggregate,
} from "../src/lib/rate-aggregates";
import {
  isCarLoanModel,
  isCreditCardModel,
  isMortgageModel,
  isPersonalLoanModel,
  parseModelByDataType,
  readLastUpdated,
  type CarLoanRatesModel,
  type CreditCardRatesModel,
  type MortgageRatesModel,
  type PersonalLoanRatesModel,
  type SupportedRatesModel,
} from "../src/lib/rates-models";

type SupportedModels = SupportedRatesModel;

type QualitySummary = {
  entities: number;
  products: number;
  ratePoints: number;
};

const QUALITY_GUARDRAILS: Record<
  DataType,
  {
    minEntities: number;
    minRatePoints: number;
  }
> = {
  "mortgage-rates": {
    minEntities: 8,
    minRatePoints: 80,
  },
  "personal-loan-rates": {
    minEntities: 6,
    minRatePoints: 20,
  },
  "car-loan-rates": {
    minEntities: 6,
    minRatePoints: 20,
  },
  "credit-card-rates": {
    minEntities: 4,
    minRatePoints: 25,
  },
};

export function hasDataChanged(
  newData: SupportedModels,
  oldData: SupportedModels,
): boolean {
  return JSON.stringify(newData.data) !== JSON.stringify(oldData.data);
}

export async function saveToConvex(
  data: MortgageRatesModel,
  dataType: "mortgage-rates",
  previousData?: MortgageRatesModel | null,
): Promise<boolean>;
export async function saveToConvex(
  data: PersonalLoanRatesModel,
  dataType: "personal-loan-rates",
  previousData?: PersonalLoanRatesModel | null,
): Promise<boolean>;
export async function saveToConvex(
  data: CarLoanRatesModel,
  dataType: "car-loan-rates",
  previousData?: CarLoanRatesModel | null,
): Promise<boolean>;
export async function saveToConvex(
  data: CreditCardRatesModel,
  dataType: "credit-card-rates",
  previousData?: CreditCardRatesModel | null,
): Promise<boolean>;
export async function saveToConvex(
  data: SupportedModels,
  dataType: DataType,
  previousData?: SupportedModels | null,
): Promise<boolean> {
  const envCheck = ora("Checking Convex environment").start();

  const ingestSecret = process.env.CONVEX_INGEST_SECRET;

  if (!ingestSecret) {
    envCheck.fail(
      "CONVEX_INGEST_SECRET is required to write to Convex. Skipping save.",
    );
    return false;
  }

  envCheck.succeed("Convex environment is configured").stop();

  const qualityCheck = ora("Running data quality checks").start();
  const qualityResult = validateDataQuality(dataType, data, previousData);

  if (!qualityResult.ok) {
    qualityCheck.fail(qualityResult.reason).stop();

    if (process.env.ALLOW_SUSPICIOUS_DATA === "true") {
      const override = ora("ALLOW_SUSPICIOUS_DATA override enabled").start();
      override.warn("Proceeding despite failed quality checks").stop();
    } else {
      return false;
    }
  } else {
    qualityCheck.succeed("Data quality checks passed").stop();
  }

  try {
    const client = createConvexClient();
    const scrapedAt = new Date().toISOString();
    const snapshotDate = scrapedAt.split("T")[0];

    if (!snapshotDate) {
      throw new Error("Unable to derive snapshot date");
    }

    const aggregate: DailyAggregate = computeDailyAggregate(
      dataType,
      data,
      scrapedAt,
    );
    const payloadHash = hashJson(data);

    const saveSpinner = ora("Saving snapshot and aggregates to Convex").start();

    await client.mutation(CONVEX_FUNCTIONS.upsertSnapshot, {
      aggregate,
      dataType,
      ingestSecret,
      modelType: modelTypeForDataType(dataType),
      payload: data,
      payloadHash,
      recordCount: aggregate.totals.ratePoints,
      scrapedAt,
      snapshotDate,
      sourceLastUpdated: readLastUpdated(data, scrapedAt),
    });

    saveSpinner
      .succeed(
        `Saved ${dataType} snapshot for ${snapshotDate} to Convex (${aggregate.totals.ratePoints} points)`,
      )
      .stop();

    return true;
  } catch (error) {
    const errorSpinner = ora("Saving snapshot to Convex").start();
    errorSpinner.fail(`Failed to save to Convex: ${error}`).stop();

    if (error instanceof Error && error.stack) {
      const stackSpinner = ora("Error details").start();
      stackSpinner.fail(`Error stack: ${error.stack}`).stop();
    }

    return false;
  }
}

export async function loadFromConvex(
  dataType: "mortgage-rates",
): Promise<MortgageRatesModel | null>;
export async function loadFromConvex(
  dataType: "personal-loan-rates",
): Promise<PersonalLoanRatesModel | null>;
export async function loadFromConvex(
  dataType: "car-loan-rates",
): Promise<CarLoanRatesModel | null>;
export async function loadFromConvex(
  dataType: "credit-card-rates",
): Promise<CreditCardRatesModel | null>;
export async function loadFromConvex(
  dataType: DataType,
): Promise<SupportedModels | null> {
  const envCheck = ora("Checking Convex read environment").start();

  if (!process.env.CONVEX_URL) {
    envCheck.warn("CONVEX_URL not set; skipping Convex read").stop();
    return null;
  }

  envCheck.succeed("Convex read environment available").stop();

  try {
    const client = createConvexClient();
    const loadSpinner = ora(`Loading latest ${dataType} data from Convex`).start();
    const result = await client.query(
      CONVEX_FUNCTIONS.getLatestByDataType,
      {
        dataType,
      },
    );

    if (!result) {
      loadSpinner.warn(`No existing ${dataType} snapshot found in Convex`).stop();
      return null;
    }

    const parsed = parseModelByDataType(dataType, result);
    loadSpinner.succeed(`Loaded ${dataType} data from Convex`).stop();
    return parsed;
  } catch (error) {
    const errorSpinner = ora("Convex read").start();
    errorSpinner.fail(`Failed to load from Convex: ${error}`).stop();
    return null;
  }
}

function summarizeDataset(dataType: DataType, data: SupportedModels): QualitySummary {
  if (!isModelValidForDataType(dataType, data)) {
    throw new Error(`Model type ${data.type} does not match data type ${dataType}`);
  }

  if (isCreditCardModel(data)) {
    const products = data.data.reduce(
      (sum, issuer) => sum + issuer.plans.length,
      0,
    );
    const ratePoints = data.data.reduce((sum, issuer) => {
      return (
        sum +
        issuer.plans.reduce((planSum, plan) => {
          const points = [
            plan.purchaseRate,
            plan.cashAdvanceRate,
            plan.balanceTransferRate,
          ].filter((value) => typeof value === "number" && Number.isFinite(value));

          return planSum + points.length;
        }, 0)
      );
    }, 0);

    return {
      entities: data.data.length,
      products,
      ratePoints,
    };
  }

  const products = data.data.reduce(
    (sum, institution) => sum + institution.products.length,
    0,
  );
  const ratePoints = data.data.reduce((sum, institution) => {
    return (
      sum +
      institution.products.reduce(
        (productSum, product) => productSum + product.rates.length,
        0,
      )
    );
  }, 0);

  return {
    entities: data.data.length,
    products,
    ratePoints,
  };
}

function validateDataQuality(
  dataType: DataType,
  nextData: SupportedModels,
  previousData?: SupportedModels | null,
): {
  ok: boolean;
  reason: string;
} {
  if (!isModelValidForDataType(dataType, nextData)) {
    return {
      ok: false,
      reason: `Quality guardrail failed: payload type ${nextData.type} does not match ${dataType}`,
    };
  }

  if (previousData && !isModelValidForDataType(dataType, previousData)) {
    return {
      ok: false,
      reason:
        `Quality guardrail failed: previous payload type ${previousData.type} does not match ${dataType}`,
    };
  }

  const baseline = QUALITY_GUARDRAILS[dataType];
  const nextSummary = summarizeDataset(dataType, nextData);

  if (nextSummary.entities < baseline.minEntities) {
    return {
      ok: false,
      reason:
        `Quality guardrail failed: ${dataType} has ${nextSummary.entities} entities ` +
        `(minimum ${baseline.minEntities})`,
    };
  }

  if (nextSummary.ratePoints < baseline.minRatePoints) {
    return {
      ok: false,
      reason:
        `Quality guardrail failed: ${dataType} has ${nextSummary.ratePoints} rate points ` +
        `(minimum ${baseline.minRatePoints})`,
    };
  }

  if (previousData) {
    const prevSummary = summarizeDataset(dataType, previousData);

    if (
      prevSummary.ratePoints > 0 &&
      nextSummary.ratePoints < Math.floor(prevSummary.ratePoints * 0.55)
    ) {
      return {
        ok: false,
        reason:
          `Quality guardrail failed: ${dataType} rate points dropped from ` +
          `${prevSummary.ratePoints} to ${nextSummary.ratePoints}`,
      };
    }

    if (
      prevSummary.entities > 0 &&
      nextSummary.entities < Math.floor(prevSummary.entities * 0.55)
    ) {
      return {
        ok: false,
        reason:
          `Quality guardrail failed: ${dataType} entities dropped from ` +
          `${prevSummary.entities} to ${nextSummary.entities}`,
      };
    }
  }

  return {
    ok: true,
    reason: "ok",
  };
}

function isModelValidForDataType(
  dataType: DataType,
  model: SupportedModels,
): boolean {
  switch (dataType) {
    case "mortgage-rates":
      return isMortgageModel(model);
    case "personal-loan-rates":
      return isPersonalLoanModel(model);
    case "car-loan-rates":
      return isCarLoanModel(model);
    case "credit-card-rates":
      return isCreditCardModel(model);
  }
}
