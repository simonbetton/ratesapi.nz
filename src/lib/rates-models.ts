import { CarLoanRates } from "../models/car-loan-rates";
import { CreditCardRates } from "../models/credit-card-rates";
import { MortgageRates } from "../models/mortgage-rates";
import { PersonalLoanRates } from "../models/personal-loan-rates";
import type { DataType } from "./data-types";

export type MortgageRatesModel = import("../models/mortgage-rates").MortgageRates;
export type PersonalLoanRatesModel = import("../models/personal-loan-rates").PersonalLoanRates;
export type CarLoanRatesModel = import("../models/car-loan-rates").CarLoanRates;
export type CreditCardRatesModel = import("../models/credit-card-rates").CreditCardRates;

export type SupportedRatesModel =
  | MortgageRatesModel
  | PersonalLoanRatesModel
  | CarLoanRatesModel
  | CreditCardRatesModel;

export type ModelByDataType = {
  "car-loan-rates": CarLoanRatesModel;
  "credit-card-rates": CreditCardRatesModel;
  "mortgage-rates": MortgageRatesModel;
  "personal-loan-rates": PersonalLoanRatesModel;
};

export function parseModelByDataType(
  dataType: "mortgage-rates",
  payload: unknown,
): MortgageRatesModel;
export function parseModelByDataType(
  dataType: "personal-loan-rates",
  payload: unknown,
): PersonalLoanRatesModel;
export function parseModelByDataType(
  dataType: "car-loan-rates",
  payload: unknown,
): CarLoanRatesModel;
export function parseModelByDataType(
  dataType: "credit-card-rates",
  payload: unknown,
): CreditCardRatesModel;
export function parseModelByDataType(
  dataType: DataType,
  payload: unknown,
): SupportedRatesModel;
export function parseModelByDataType(
  dataType: DataType,
  payload: unknown,
): SupportedRatesModel {
  switch (dataType) {
    case "mortgage-rates":
      return MortgageRates.parse(payload);
    case "personal-loan-rates":
      return PersonalLoanRates.parse(payload);
    case "car-loan-rates":
      return CarLoanRates.parse(payload);
    case "credit-card-rates":
      return CreditCardRates.parse(payload);
  }
}

export function parseModelRecordByDataType(
  dataType: "mortgage-rates",
  payload: unknown,
): Record<string, MortgageRatesModel>;
export function parseModelRecordByDataType(
  dataType: "personal-loan-rates",
  payload: unknown,
): Record<string, PersonalLoanRatesModel>;
export function parseModelRecordByDataType(
  dataType: "car-loan-rates",
  payload: unknown,
): Record<string, CarLoanRatesModel>;
export function parseModelRecordByDataType(
  dataType: "credit-card-rates",
  payload: unknown,
): Record<string, CreditCardRatesModel>;
export function parseModelRecordByDataType(
  dataType: DataType,
  payload: unknown,
): Record<string, SupportedRatesModel>;
export function parseModelRecordByDataType(
  dataType: DataType,
  payload: unknown,
): Record<string, SupportedRatesModel> {
  if (!isRecord(payload)) {
    return {};
  }

  const output: Record<string, SupportedRatesModel> = {};

  for (const [date, value] of Object.entries(payload)) {
    output[date] = parseModelByDataType(dataType, value);
  }

  return output;
}

export function isCreditCardModel(
  model: SupportedRatesModel,
): model is CreditCardRatesModel {
  return model.type === "CreditCardRates";
}

export function isMortgageModel(
  model: SupportedRatesModel,
): model is MortgageRatesModel {
  return model.type === "MortgageRates";
}

export function isPersonalLoanModel(
  model: SupportedRatesModel,
): model is PersonalLoanRatesModel {
  return model.type === "PersonalLoanRates";
}

export function isCarLoanModel(
  model: SupportedRatesModel,
): model is CarLoanRatesModel {
  return model.type === "CarLoanRates";
}

export function readLastUpdated(
  model: SupportedRatesModel,
  fallbackIso: string,
): string {
  return model.lastUpdated.length > 0 ? model.lastUpdated : fallbackIso;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
