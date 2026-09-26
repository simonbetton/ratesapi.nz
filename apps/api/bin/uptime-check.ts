// This script is used to check the uptime of the API endpoints and the docs site

import { createHttpClient } from "../src/lib/http-client";

const KNOWN_HISTORICAL_START_DATE = "2026-04-24";
const KNOWN_HISTORICAL_END_DATE = "2026-04-30";

// A new query value for each run, so Cloudflare cannot answer the docs checks
// from its cache: the docs Worker itself must answer.
const CACHE_BUSTER = `uptime-check=${Date.now()}`;

// Each attempt fails after this time, so a server that hangs is a failure
// instead of a check that never ends.
const REQUEST_TIMEOUT_MS = 15_000;

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

  // Docs site (a separate Worker). These paths resolve against the origin.
  `/docs?${CACHE_BUSTER}`,
  `/docs/api-reference/quickstart?${CACHE_BUSTER}`,
];

const httpClient = createHttpClient("UptimeCheck", {
  prefixUrl: "https://www.ratesapi.nz/api/",
  headers: {
    "User-Agent": "RatesAPI/UptimeCheck",
  },
  retryOptions: {
    retries: 3,
    retryDelay: 1000,
    retryOn: [500, 502, 503, 504],
  },
  timeoutMs: REQUEST_TIMEOUT_MS,
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
      // Read the whole body: a response that stops part way is a failure too.
      await response.arrayBuffer();
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
        `❌ ${result.endpoint} - ${result.reason}: ${result.errorDetails}`
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
    for (const { endpoint, error } of failedEndpoints) {
      console.log(`- ${endpoint} (${error})`);
    }
    // Exit with non-zero code to indicate failure
    process.exit(1);
  } else {
    console.log("\n--- Uptime Check Successful ---");
    console.log("All endpoints are responding correctly.");
    // Exit with zero code for success
    process.exit(0);
  }
}

try {
  await main();
} catch (error) {
  console.error("Unhandled error during uptime check:", error);
  process.exit(1);
}
