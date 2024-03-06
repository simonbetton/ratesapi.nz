import { writeFileSync } from "fs";
import { type CarLoanRates } from "../src/models/car-loan-rates";
import { type CreditCardRates } from "../src/models/credit-card-rates";
import { type MortgageRates } from "../src/models/mortgage-rates";
import { type PersonalLoanRates } from "../src/models/personal-loan-rates";

type SupportedModels =
  | MortgageRates
  | PersonalLoanRates
  | CarLoanRates
  | CreditCardRates;

export function hasDataChanged(
  newData: SupportedModels,
  oldData: SupportedModels,
): boolean {
  return JSON.stringify(newData.data) !== JSON.stringify(oldData.data);
}

export function saveDataToFile(
  data: SupportedModels,
  config: { outputFilePath: string },
) {
  writeFileSync(config.outputFilePath, JSON.stringify(data, null, 2));
}
