import { execFileSync } from "node:child_process";
import {
  type DataType,
  type SupportedModels,
  toSavableJson,
} from "../src/lib/data-loader";
import { type CarLoanRates } from "../src/models/car-loan-rates";
import { type CreditCardRates } from "../src/models/credit-card-rates";
import { type MortgageRates } from "../src/models/mortgage-rates";
import { type PersonalLoanRates } from "../src/models/personal-loan-rates";

const seedDate = "2026-04-30";

const mortgageRates: MortgageRates = {
  type: "MortgageRates",
  lastUpdated: "2026-04-30T00:00:00.000Z",
  data: [
    {
      id: "institution:anz",
      name: "ANZ",
      products: [
        {
          id: "product:anz:standard",
          name: "Standard",
          rates: [
            {
              id: "rate:anz:standard:6-months",
              rate: 6.29,
              term: "6 months",
              termInMonths: 6,
            },
            {
              id: "rate:anz:standard:1-year",
              rate: 6.49,
              term: "1 year",
              termInMonths: 12,
            },
          ],
        },
      ],
    },
  ],
};

const personalLoanRates: PersonalLoanRates = {
  type: "PersonalLoanRates",
  lastUpdated: "2026-04-30T00:00:00.000Z",
  data: [
    {
      id: "institution:asb",
      name: "ASB",
      products: [
        {
          id: "product:asb:personal-loan",
          name: "Personal Loan",
          rates: [
            {
              id: "rate:asb:personal-loan:secured",
              rate: 12.95,
              plan: "Secured",
              condition: "$3,000 to $50,000",
            },
          ],
        },
      ],
    },
  ],
};

const carLoanRates: CarLoanRates = {
  type: "CarLoanRates",
  lastUpdated: "2026-04-30T00:00:00.000Z",
  data: [
    {
      id: "institution:asb",
      name: "ASB",
      products: [
        {
          id: "product:asb:car-loan",
          name: "Car Loan",
          rates: [
            {
              id: "rate:asb:car-loan:secured",
              rate: 13.95,
              plan: "Secured",
              condition: "$5,000 plus",
            },
          ],
        },
      ],
    },
  ],
};

const creditCardRates: CreditCardRates = {
  type: "CreditCardRates",
  lastUpdated: "2026-04-30T00:00:00.000Z",
  data: [
    {
      id: "issuer:amex",
      name: "Amex",
      plans: [
        {
          id: "plan:amex:airpoints-card",
          name: "Airpoints Card",
          interestFreePeriodInMonths: 55,
          primaryFeeNZD: 195,
          balanceTransferRate: null,
          balanceTransferPeriod: null,
          cashAdvanceRate: 22.95,
          purchaseRate: 21.95,
        },
      ],
    },
  ],
};

const seedRows: Array<{ dataType: DataType; data: SupportedModels }> = [
  { dataType: "mortgage-rates", data: mortgageRates },
  { dataType: "personal-loan-rates", data: personalLoanRates },
  { dataType: "car-loan-rates", data: carLoanRates },
  { dataType: "credit-card-rates", data: creditCardRates },
];

const seedStatements: string[] = [];

for (const row of seedRows) {
  const data = toSavableJson(row.data);

  seedStatements.push(
    `INSERT OR IGNORE INTO latest_data (data_type, data, last_updated) VALUES ('${row.dataType}', '${data}', '${row.data.lastUpdated}')`,
    `INSERT OR IGNORE INTO historical_data (data_type, date, data) VALUES ('${row.dataType}', '${seedDate}', '${data}')`,
  );
}

runLocalD1(seedStatements.join(";"));

function runLocalD1(command: string): void {
  execFileSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      "ratesapi-data",
      "--config",
      "apps/api/wrangler.toml",
      "--env",
      "development",
      "--local",
      "--command",
      command,
    ],
    {
      stdio: "inherit",
    },
  );
}
