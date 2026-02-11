import type { DataType } from "./data-types";
import {
  isCarLoanModel,
  isCreditCardModel,
  isMortgageModel,
  isPersonalLoanModel,
  type CarLoanRatesModel,
  type CreditCardRatesModel,
  type MortgageRatesModel,
  type PersonalLoanRatesModel,
  type SupportedRatesModel,
} from "./rates-models";

type Stats = {
  avg: number | null;
  max: number | null;
  min: number | null;
  samples: number;
};

type AggregateEntity = {
  entityId: string;
  entityName: string;
  stats: Stats;
};

export type DailyAggregate = {
  byEntity: AggregateEntity[];
  byTermInMonths: Array<{
    stats: Stats;
    termInMonths: number;
  }>;
  dataType: DataType;
  generatedAt: string;
  totals: {
    entities: number;
    products: number;
    ratePoints: number;
  };
  overall: Stats;
};

export function computeDailyAggregate(
  dataType: "mortgage-rates",
  model: MortgageRatesModel,
  generatedAt: string,
): DailyAggregate;
export function computeDailyAggregate(
  dataType: "personal-loan-rates",
  model: PersonalLoanRatesModel,
  generatedAt: string,
): DailyAggregate;
export function computeDailyAggregate(
  dataType: "car-loan-rates",
  model: CarLoanRatesModel,
  generatedAt: string,
): DailyAggregate;
export function computeDailyAggregate(
  dataType: "credit-card-rates",
  model: CreditCardRatesModel,
  generatedAt: string,
): DailyAggregate;
export function computeDailyAggregate(
  dataType: DataType,
  model: SupportedRatesModel,
  generatedAt: string,
): DailyAggregate;
export function computeDailyAggregate(
  dataType: DataType,
  model: SupportedRatesModel,
  generatedAt: string,
): DailyAggregate {
  switch (dataType) {
    case "mortgage-rates":
      if (!isMortgageModel(model)) {
        throw new Error("Expected MortgageRates model for mortgage-rates data type");
      }
      return computeMortgageAggregate(model, generatedAt);
    case "personal-loan-rates":
      if (!isPersonalLoanModel(model)) {
        throw new Error("Expected PersonalLoanRates model for personal-loan-rates data type");
      }
      return computeInstitutionAggregate(dataType, model, generatedAt);
    case "car-loan-rates":
      if (!isCarLoanModel(model)) {
        throw new Error("Expected CarLoanRates model for car-loan-rates data type");
      }
      return computeInstitutionAggregate(dataType, model, generatedAt);
    case "credit-card-rates":
      if (!isCreditCardModel(model)) {
        throw new Error("Expected CreditCardRates model for credit-card-rates data type");
      }
      return computeCreditCardAggregate(model, generatedAt);
  }
}

export function isDailyAggregate(value: unknown): value is DailyAggregate {
  if (!isRecord(value)) {
    return false;
  }

  if (!isDataTypeValue(value.dataType)) {
    return false;
  }

  if (!Array.isArray(value.byEntity) || !Array.isArray(value.byTermInMonths)) {
    return false;
  }

  if (!isStats(value.overall) || !isTotals(value.totals)) {
    return false;
  }

  if (typeof value.generatedAt !== "string") {
    return false;
  }

  for (const entity of value.byEntity) {
    if (!isAggregateEntity(entity)) {
      return false;
    }
  }

  for (const termStats of value.byTermInMonths) {
    if (!isRecord(termStats)) {
      return false;
    }

    if (typeof termStats.termInMonths !== "number" || !isStats(termStats.stats)) {
      return false;
    }
  }

  return true;
}

export function isDailyAggregateRecord(
  value: unknown,
): value is Record<string, DailyAggregate> {
  if (!isRecord(value)) {
    return false;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (typeof key !== "string" || !isDailyAggregate(entry)) {
      return false;
    }
  }

  return true;
}

function computeInstitutionAggregate(
  dataType: "personal-loan-rates" | "car-loan-rates",
  model: PersonalLoanRatesModel | CarLoanRatesModel,
  generatedAt: string,
): DailyAggregate {
  const allValues: number[] = [];
  const byEntity: AggregateEntity[] = [];
  let productCount = 0;

  for (const institution of model.data) {
    const institutionValues: number[] = [];

    for (const product of institution.products) {
      productCount += 1;

      for (const rate of product.rates) {
        if (Number.isFinite(rate.rate)) {
          institutionValues.push(rate.rate);
          allValues.push(rate.rate);
        }
      }
    }

    byEntity.push({
      entityId: institution.id,
      entityName: institution.name,
      stats: summarize(institutionValues),
    });
  }

  return {
    byEntity,
    byTermInMonths: [],
    dataType,
    generatedAt,
    totals: {
      entities: model.data.length,
      products: productCount,
      ratePoints: allValues.length,
    },
    overall: summarize(allValues),
  };
}

function computeMortgageAggregate(
  model: MortgageRatesModel,
  generatedAt: string,
): DailyAggregate {
  const allValues: number[] = [];
  const byEntity: AggregateEntity[] = [];
  const byTerm = new Map<number, number[]>();
  let productCount = 0;

  for (const institution of model.data) {
    const institutionValues: number[] = [];

    for (const product of institution.products) {
      productCount += 1;

      for (const rate of product.rates) {
        if (Number.isFinite(rate.rate)) {
          institutionValues.push(rate.rate);
          allValues.push(rate.rate);

          if (typeof rate.termInMonths === "number") {
            const current = byTerm.get(rate.termInMonths) ?? [];
            current.push(rate.rate);
            byTerm.set(rate.termInMonths, current);
          }
        }
      }
    }

    byEntity.push({
      entityId: institution.id,
      entityName: institution.name,
      stats: summarize(institutionValues),
    });
  }

  return {
    byEntity,
    byTermInMonths: Array.from(byTerm.entries())
      .map(([termInMonths, values]) => ({
        stats: summarize(values),
        termInMonths,
      }))
      .sort((left, right) => left.termInMonths - right.termInMonths),
    dataType: "mortgage-rates",
    generatedAt,
    totals: {
      entities: model.data.length,
      products: productCount,
      ratePoints: allValues.length,
    },
    overall: summarize(allValues),
  };
}

function computeCreditCardAggregate(
  model: CreditCardRatesModel,
  generatedAt: string,
): DailyAggregate {
  const allValues: number[] = [];
  const byEntity: AggregateEntity[] = [];
  let productCount = 0;

  for (const issuer of model.data) {
    const issuerValues: number[] = [];
    productCount += issuer.plans.length;

    for (const plan of issuer.plans) {
      const planValues = [
        plan.purchaseRate,
        plan.cashAdvanceRate,
        plan.balanceTransferRate,
      ].filter((value): value is number =>
        typeof value === "number" && Number.isFinite(value),
      );

      issuerValues.push(...planValues);
      allValues.push(...planValues);
    }

    byEntity.push({
      entityId: issuer.id,
      entityName: issuer.name,
      stats: summarize(issuerValues),
    });
  }

  return {
    byEntity,
    byTermInMonths: [],
    dataType: "credit-card-rates",
    generatedAt,
    totals: {
      entities: model.data.length,
      products: productCount,
      ratePoints: allValues.length,
    },
    overall: summarize(allValues),
  };
}

function summarize(values: number[]): Stats {
  if (values.length === 0) {
    return {
      avg: null,
      max: null,
      min: null,
      samples: 0,
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const total = values.reduce((sum, value) => sum + value, 0);

  return {
    avg: Number((total / values.length).toFixed(6)),
    max: Number(max.toFixed(6)),
    min: Number(min.toFixed(6)),
    samples: values.length,
  };
}

function isAggregateEntity(value: unknown): value is AggregateEntity {
  return (
    isRecord(value) &&
    typeof value.entityId === "string" &&
    typeof value.entityName === "string" &&
    isStats(value.stats)
  );
}

function isDataTypeValue(value: unknown): value is DataType {
  return (
    value === "mortgage-rates" ||
    value === "personal-loan-rates" ||
    value === "car-loan-rates" ||
    value === "credit-card-rates"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStats(value: unknown): value is Stats {
  return (
    isRecord(value) &&
    isNullableNumber(value.avg) &&
    isNullableNumber(value.max) &&
    isNullableNumber(value.min) &&
    typeof value.samples === "number"
  );
}

function isTotals(
  value: unknown,
): value is DailyAggregate["totals"] {
  return (
    isRecord(value) &&
    typeof value.entities === "number" &&
    typeof value.products === "number" &&
    typeof value.ratePoints === "number"
  );
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}
