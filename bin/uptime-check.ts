// This script is used to check the uptime of the API endpoints

import { createHttpClient } from "../src/lib/http-client";

const LAST_WEEK = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
const TODAY = new Date().toISOString().split("T")[0];

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

  // Documentation
  "v1/doc",

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
  `v1/mortgage-rates/time-series?startDate=${LAST_WEEK}&endDate=${TODAY}`,
  `v1/mortgage-rates/time-series?date=${TODAY}`,

  // Time Series with combined filters
  `v1/mortgage-rates/time-series?startDate=${LAST_WEEK}&endDate=${TODAY}&institutionId=institution:anz`,
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

async function main() {
  const failedEndpoints = [];

  console.log(`Checking ${endpoints.length} endpoints...`);

  for (const endpoint of endpoints) {
    let success = false;
    let errorDetails = "Unknown error";
    try {
      const response = await httpClient(endpoint);
      // Assuming a successful request implies the endpoint is up.
      // You might want to add more specific checks on the response status or body.
      if (response.ok) {
        success = true;
        console.log(`✅ ${endpoint}`);
      } else {
        errorDetails = `Status ${response.status}`;
        console.error(`❌ ${endpoint} - Failed: ${errorDetails}`);
      }
    } catch (error: any) {
      errorDetails = error.message || String(error);
      console.error(`❌ ${endpoint} - Error: ${errorDetails}`);
    }

    if (!success) {
      failedEndpoints.push({ endpoint, error: errorDetails });
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
