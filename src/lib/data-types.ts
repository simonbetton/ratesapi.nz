export type DataType =
  | "mortgage-rates"
  | "personal-loan-rates"
  | "car-loan-rates"
  | "credit-card-rates";

export const DATA_TYPES: DataType[] = [
  "mortgage-rates",
  "personal-loan-rates",
  "car-loan-rates",
  "credit-card-rates",
];

export function isDataType(value: string): value is DataType {
  return DATA_TYPES.some((dataType) => dataType === value);
}

export function modelTypeForDataType(dataType: DataType): string {
  switch (dataType) {
    case "mortgage-rates":
      return "MortgageRates";
    case "personal-loan-rates":
      return "PersonalLoanRates";
    case "car-loan-rates":
      return "CarLoanRates";
    case "credit-card-rates":
      return "CreditCardRates";
  }
}
