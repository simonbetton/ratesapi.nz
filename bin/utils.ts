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

export async function fetchWithTimeout(
  resource: string,
  options: RequestInit = {},
  timeout: number = 2000,
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const response = await fetch(resource, {
    ...options,
    signal: controller.signal, // Pass the abort signal to the fetch call
  }).catch((error) => {
    if (error.name === "AbortError") {
      throw new Error("Fetch request timed out");
    } else {
      throw error; // Rethrow other errors for caller to handle
    }
  });

  clearTimeout(id); // Clear the timeout if the fetch completes in time
  return response;
}

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
