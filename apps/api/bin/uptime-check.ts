// This script is used to check the uptime of the API endpoints

import { createHttpClient } from "../src/lib/http-client";

const KNOWN_HISTORICAL_START_DATE = "2026-04-24";
const KNOWN_HISTORICAL_END_DATE = "2026-04-30";

const endpoints = [
  // Base endpoints
  "v1/mortgage-rates",
  "v1/personal-loan-rates",
  "v1/car-loan-rates",
  "v1/credit-card-rates",

  // Institution/issuer specific endpoints
  "v1/mortgage-rates/institution:anz",
  "v1/personal-loan-rates/institution:asb",
  "v1/car-loan-rates/institution:asb",
  "v1/credit-card-rates/issuer:amex",

  // Health
  "v1/health",

  // Basic Time Series API endpoints
  "v1/mortgage-rates/time-series",
  "v1/personal-loan-rates/time-series",
  "v1/car-loan-rates/time-series",
  "v1/credit-card-rates/time-series",

  // Time Series with institution/issuer parameters
  "v1/mortgage-rates/time-series?institutionId=institution:anz",
  "v1/personal-loan-rates/time-series?institutionId=institution:asb",
  "v1/car-loan-rates/time-series?institutionId=institution:asb",
  "v1/credit-card-rates/time-series?issuerId=issuer:amex",

  // Time Series with date parameters
  `v1/mortgage-rates/time-series?startDate=${KNOWN_HISTORICAL_START_DATE}&endDate=${KNOWN_HISTORICAL_END_DATE}`,
  `v1/mortgage-rates/time-series?date=${KNOWN_HISTORICAL_END_DATE}`,

  // Time Series with combined filters
  `v1/mortgage-rates/time-series?startDate=${KNOWN_HISTORICAL_START_DATE}&endDate=${KNOWN_HISTORICAL_END_DATE}&institutionId=institution:anz`,
  `v1/mortgage-rates/time-series?institutionId=institution:anz&termInMonths=12`,
];

const httpClient = createHttpClient("UptimeCheck", {
  prefixUrl: "https://ratesapi.nz/api/",
  headers: {
    "User-Agent": "RatesAPI/UptimeCheck",
  },
  retryOptions: {
    retries: 3,
    retryDelay: 1000,
    retryOn: [500, 502, 503, 504],
  },
});

type EndpointCheckResult =
  | { endpoint: string; success: true }
  | {
      endpoint: string;
      success: false;
      reason: "Failed" | "Error";
      errorDetails: string;
    };

// Never rejects: every outcome is captured in the result so one failing
// endpoint can't cut the other checks short.
async function checkEndpoint(endpoint: string): Promise<EndpointCheckResult> {
  try {
    const response = await httpClient(endpoint);
    // Assuming a successful request implies the endpoint is up.
    // You might want to add more specific checks on the response status or body.
    if (response.ok) {
      return { endpoint, success: true };
    }
    return {
      endpoint,
      success: false,
      reason: "Failed",
      errorDetails: `Status ${response.status}`,
    };
  } catch (error: unknown) {
    return {
      endpoint,
      success: false,
      reason: "Error",
      errorDetails: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const failedEndpoints = [];

  console.log(`Checking ${endpoints.length} endpoints...`);

  // Each check is an independent read-only GET, so run them concurrently.
  // Results come back in `endpoints` order, keeping the log output stable.
  const results = await Promise.all(endpoints.map(checkEndpoint));

  for (const result of results) {
    if (result.success) {
      console.log(`✅ ${result.endpoint}`);
    } else {
      console.error(
        `❌ ${result.endpoint} - ${result.reason}: ${result.errorDetails}`,
      );
      failedEndpoints.push({
        endpoint: result.endpoint,
        error: result.errorDetails,
      });
    }
  }

  if (failedEndpoints.length > 0) {
    console.log("\n--- Uptime Check Failed ---");
    console.log("The following endpoints failed:");
    failedEndpoints.forEach(({ endpoint, error }) => {
      console.log(`- ${endpoint} (${error})`);
    });
    process.exit(1); // Exit with non-zero code to indicate failure
  } else {
    console.log("\n--- Uptime Check Successful ---");
    console.log("All endpoints are responding correctly.");
    process.exit(0); // Exit with zero code for success
  }
}

main().catch((error) => {
  console.error("Unhandled error during uptime check:", error);
  process.exit(1);
});
