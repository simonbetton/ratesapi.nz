import { env } from "cloudflare:test";

/**
 * Initialize the D1 database schema for testing
 */
export async function setupTestDatabase() {
  const db = env.RATESAPI_DB;

  // Create historical_data table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS historical_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data_type TEXT NOT NULL,
      date TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(data_type, date)
    )
  `);

  // Create latest_data table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS latest_data (
      data_type TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_historical_data_type ON historical_data(data_type)`
  );
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_historical_date ON historical_data(date)`
  );
}

/**
 * Insert mock data for testing
 */
export async function insertMockData() {
  const db = env.RATESAPI_DB;

  // Sample mortgage rates data
  const mortgageRatesData = {
    type: "MortgageRates",
    data: [
      {
        id: "institution:test-bank",
        name: "Test Bank",
        products: [
          {
            id: "product:standard",
            name: "Standard Home Loan",
            rates: [
              { id: "rate:12m", termInMonths: 12, rate: 6.5 },
              { id: "rate:24m", termInMonths: 24, rate: 6.2 },
            ],
          },
        ],
      },
    ],
    lastUpdated: "2025-01-01T00:00:00.000Z",
  };

  // Sample credit card rates data
  const creditCardRatesData = {
    type: "CreditCardRates",
    data: [
      {
        id: "issuer:test-bank",
        name: "Test Bank",
        products: [
          {
            id: "product:standard-card",
            name: "Standard Credit Card",
            purchaseRate: 19.95,
            cashRate: 21.95,
          },
        ],
      },
    ],
    lastUpdated: "2025-01-01T00:00:00.000Z",
  };

  // Base64 encode the data (as the app does)
  const encodedMortgage = btoa(JSON.stringify(mortgageRatesData));
  const encodedCreditCard = btoa(JSON.stringify(creditCardRatesData));

  // Insert latest data
  await db
    .prepare(
      `INSERT OR REPLACE INTO latest_data (data_type, data) VALUES (?, ?)`
    )
    .bind("mortgage-rates", encodedMortgage)
    .run();

  await db
    .prepare(
      `INSERT OR REPLACE INTO latest_data (data_type, data) VALUES (?, ?)`
    )
    .bind("credit-card-rates", encodedCreditCard)
    .run();

  // Insert historical data
  await db
    .prepare(
      `INSERT OR REPLACE INTO historical_data (data_type, date, data) VALUES (?, ?, ?)`
    )
    .bind("mortgage-rates", "2025-01-01", encodedMortgage)
    .run();

  await db
    .prepare(
      `INSERT OR REPLACE INTO historical_data (data_type, date, data) VALUES (?, ?, ?)`
    )
    .bind("credit-card-rates", "2025-01-01", encodedCreditCard)
    .run();
}

/**
 * Clear all test data
 */
export async function clearTestData() {
  const db = env.RATESAPI_DB;
  await db.exec(`DELETE FROM historical_data`);
  await db.exec(`DELETE FROM latest_data`);
}
