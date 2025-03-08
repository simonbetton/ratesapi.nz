import { D1Database } from '@cloudflare/workers-types';
import { saveHistoricalData } from "../src/lib/data-loader";
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

// saveDataToFile function has been removed as we're using D1 for data storage now

// forceUpdateD1FromLocalFiles has been removed as we're no longer using the file system for data storage

/**
 * Gets a connection to the D1 database
 * 
 * Note: This function is intended for CI/GitHub Actions environments.
 * For local development, use `wrangler d1 execute` commands directly.
 */
export async function getD1Connection(): Promise<D1Database | null> {
  try {
    if (!process.env.D1_DATABASE_ID) {
      console.warn("D1_DATABASE_ID not set in environment variables");
      return null;
    }

    // For now, this is a placeholder. In GitHub Actions, we'll use
    // wrangler CLI commands directly rather than programmatic access.
    console.log("D1 database connections are only supported in GitHub Actions environment");
    return null;
  } catch (error) {
    console.error("Failed to connect to D1 database:", error);
    return null;
  }
}

/**
 * Directly save data to D1 using wrangler CLI
 * This is the preferred method for saving data in CI environments
 */
export async function saveToD1(
  data: SupportedModels,
  dataType: "mortgage-rates" | "car-loan-rates" | "credit-card-rates" | "personal-loan-rates"
): Promise<boolean> {
  // Check environment variables
  console.log(`Environment check: CI=${process.env.CI}, GITHUB_ACTIONS=${process.env.GITHUB_ACTIONS}, D1_DATABASE_ID=${process.env.D1_DATABASE_ID ? "set" : "not set"}`);
  
  // Check for D1_DATABASE_ID and CI environment
  const isCI = process.env.CI === "true" || !!process.env.GITHUB_ACTIONS;
  
  if (!isCI) {
    // In local dev, just log and skip database update
    console.log(`ℹ️ Skipping D1 database update in local development mode.`);
    return false;
  }
  
  console.log(`🔍 Running in CI environment, proceeding with D1 database update.`);
  
  // Check for database ID
  if (!process.env.D1_DATABASE_ID) {
    console.log(`⚠️ D1_DATABASE_ID not set. Set this environment variable to enable database updates.`);
    return false;
  }
  
  try {
    const timestamp = new Date().toISOString().split("T")[0]; // Format: YYYY-MM-DD
    console.log(`Using D1 database ID: ${process.env.D1_DATABASE_ID}`);
    
    // Verify data.json access
    const jsonData = JSON.stringify(data).replace(/"/g, '\\"'); // Escape double quotes for SQL
    console.log(`Data successfully prepared for SQL insertion (${jsonData.length} characters)`);
    
    // Import child_process for CLI commands
    const { execSync } = await import('child_process');
    
    // Test D1 access first
    console.log(`🔍 Testing D1 database access...`);
    const testResult = execSync(
      `npx wrangler d1 execute ${process.env.D1_DATABASE_ID} --command="SELECT count(*) FROM sqlite_master"`
    ).toString();
    console.log(`D1 access test result: ${testResult}`);
    
    // Save to historical_data table
    console.log(`📊 Saving historical data for ${dataType} on ${timestamp} to D1...`);
    execSync(
      `npx wrangler d1 execute ${process.env.D1_DATABASE_ID} --command="INSERT OR REPLACE INTO historical_data (data_type, date, data) VALUES ('${dataType}', '${timestamp}', '${jsonData}')"`
    );
    
    // Update latest_data table
    console.log(`📊 Updating latest data for ${dataType} in D1...`);
    execSync(
      `npx wrangler d1 execute ${process.env.D1_DATABASE_ID} --command="INSERT OR REPLACE INTO latest_data (data_type, data, last_updated) VALUES ('${dataType}', '${jsonData}', CURRENT_TIMESTAMP)"`
    );
    
    // Verify the data was saved
    console.log(`🔍 Verifying data was saved...`);
    const verifyResult = execSync(
      `npx wrangler d1 execute ${process.env.D1_DATABASE_ID} --command="SELECT data_type, last_updated FROM latest_data WHERE data_type='${dataType}'"`
    ).toString();
    console.log(`Verification result: ${verifyResult}`);
    
    console.log(`✅ Data saved to D1 database for ${dataType} on ${timestamp}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to save data to D1 database:`, error);
    // Log the error for debugging
    if (error instanceof Error) {
      console.error(`Error stack: ${error.stack}`);
    }
    return false;
  }
}

/**
 * Load data from D1 database
 */
export async function loadFromD1<T extends SupportedModels>(
  dataType: "mortgage-rates" | "car-loan-rates" | "credit-card-rates" | "personal-loan-rates"
): Promise<T | null> {
  // Check for D1_DATABASE_ID and CI environment
  const isCI = !!process.env.CI || !!process.env.GITHUB_ACTIONS;
  
  // Check if D1 database is available
  if (!isCI || !process.env.D1_DATABASE_ID) {
    console.log(`ℹ️ Running in local development mode without D1 access.`);
    return null;
  }
  
  // In CI environment with D1_DATABASE_ID, try database
  try {
    const { execSync } = await import('child_process');
    
    // Query the latest data from D1
    console.log(`📊 Loading latest data for ${dataType} from D1...`);
    const result = execSync(
      `npx wrangler d1 execute ${process.env.D1_DATABASE_ID} --command="SELECT data FROM latest_data WHERE data_type = '${dataType}'" --json`
    ).toString();
    
    const parsedResult = JSON.parse(result);
    if (parsedResult.results && parsedResult.results.length > 0) {
      console.log(`✅ Data loaded from D1 database for ${dataType}`);
      return JSON.parse(parsedResult.results[0].data) as T;
    }
    
    console.log(`⚠️ No data found in D1 for ${dataType}`);
  } catch (error) {
    console.log(`⚠️ Database connection failed: ${error}`);
  }
  
  return null;
}