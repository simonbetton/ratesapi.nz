import { D1Database } from '@cloudflare/workers-types';
import ora from "ora";
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
  const connectionSpinner = ora("Checking D1 database connection").start();
  try {
    if (!process.env.D1_DATABASE_ID) {
      connectionSpinner.warn("D1_DATABASE_ID not set in environment variables").stop();
      return null;
    }

    // For now, this is a placeholder. In GitHub Actions, we'll use
    // wrangler CLI commands directly rather than programmatic access.
    connectionSpinner.info("D1 database connections are only supported in GitHub Actions environment").stop();
    return null;
  } catch (error) {
    connectionSpinner.fail(`Failed to connect to D1 database: ${error}`).stop();
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
  const envCheck = ora("Checking environment").start();
  envCheck.info(`CI=${process.env.CI}, GITHUB_ACTIONS=${process.env.GITHUB_ACTIONS}, D1_DATABASE_ID=${process.env.D1_DATABASE_ID ? "set" : "not set"}`).stop();
  
  // Check for D1_DATABASE_ID and CI environment
  const isCI = process.env.CI === "true" || !!process.env.GITHUB_ACTIONS;
  
  if (!isCI) {
    const skipSpinner = ora("Checking CI environment").start();
    skipSpinner.warn("Skipping D1 database update in local development mode").stop();
    return false;
  }
  
  const ciSpinner = ora("Running in CI environment").start();
  ciSpinner.succeed("Proceeding with D1 database update").stop();
  
  // Check for database ID
  if (!process.env.D1_DATABASE_ID) {
    const noDbSpinner = ora("Checking D1 database ID").start();
    noDbSpinner.fail("D1_DATABASE_ID not set. Set this environment variable to enable database updates").stop();
    return false;
  }
  
  try {
    const timestamp = new Date().toISOString().split("T")[0]; // Format: YYYY-MM-DD
    
    // Prepare data for insertion
    const prepareSpinner = ora("Preparing data for D1").start();
    const jsonData = JSON.stringify(data).replace(/"/g, '\\"'); // Escape double quotes for SQL
    prepareSpinner.succeed(`Data prepared for SQL insertion (${jsonData.length} characters)`).stop();
    
    // Import child_process for CLI commands
    const { execSync } = await import('child_process');
    
    // Test D1 access first
    const testSpinner = ora("Testing D1 database access").start();
    const testResult = execSync(
      `npx wrangler d1 execute ${process.env.D1_DATABASE_ID} --command="SELECT count(*) FROM sqlite_master"`
    ).toString();
    testSpinner.succeed(`D1 access test successful: ${testResult.trim()}`).stop();
    
    // Save to historical_data table
    const historySpinner = ora(`Saving historical data for ${dataType}`).start();
    execSync(
      `npx wrangler d1 execute ${process.env.D1_DATABASE_ID} --command="INSERT OR REPLACE INTO historical_data (data_type, date, data) VALUES ('${dataType}', '${timestamp}', '${jsonData}')"`
    );
    historySpinner.succeed(`Historical data saved for ${dataType} on ${timestamp}`).stop();
    
    // Update latest_data table
    const latestSpinner = ora(`Updating latest data for ${dataType}`).start();
    execSync(
      `npx wrangler d1 execute ${process.env.D1_DATABASE_ID} --command="INSERT OR REPLACE INTO latest_data (data_type, data, last_updated) VALUES ('${dataType}', '${jsonData}', CURRENT_TIMESTAMP)"`
    );
    latestSpinner.succeed(`Latest data updated for ${dataType}`).stop();
    
    // Verify the data was saved
    const verifySpinner = ora("Verifying data was saved").start();
    const verifyResult = execSync(
      `npx wrangler d1 execute ${process.env.D1_DATABASE_ID} --command="SELECT data_type, last_updated FROM latest_data WHERE data_type='${dataType}'"`
    ).toString();
    verifySpinner.succeed(`Verification successful: ${verifyResult.trim()}`).stop();
    
    return true;
  } catch (error) {
    const errorSpinner = ora("Saving to D1 database").start();
    errorSpinner.fail(`Failed to save data to D1 database: ${error}`).stop();
    
    // Log the error for debugging
    if (error instanceof Error && error.stack) {
      const stackSpinner = ora("Error details").start();
      stackSpinner.fail(`Error stack: ${error.stack}`).stop();
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
  const envCheck = ora("Checking D1 environment").start();
  const isCI = !!process.env.CI || !!process.env.GITHUB_ACTIONS;
  
  // Check if D1 database is available
  if (!isCI || !process.env.D1_DATABASE_ID) {
    envCheck.warn("Running in local development mode without D1 access").stop();
    return null;
  }
  
  envCheck.succeed("D1 access available").stop();
  
  // In CI environment with D1_DATABASE_ID, try database
  try {
    const { execSync } = await import('child_process');
    
    // Query the latest data from D1
    const loadSpinner = ora(`Loading latest data for ${dataType} from D1`).start();
    const result = execSync(
      `npx wrangler d1 execute ${process.env.D1_DATABASE_ID} --command="SELECT data FROM latest_data WHERE data_type = '${dataType}'" --json`
    ).toString();
    
    const parsedResult = JSON.parse(result);
    if (parsedResult.results && parsedResult.results.length > 0) {
      loadSpinner.succeed(`Data loaded from D1 database for ${dataType}`).stop();
      return JSON.parse(parsedResult.results[0].data) as T;
    }
    
    loadSpinner.warn(`No data found in D1 for ${dataType}`).stop();
  } catch (error) {
    const errorSpinner = ora("D1 database connection").start();
    errorSpinner.fail(`Database connection failed: ${error}`).stop();
  }
  
  return null;
}