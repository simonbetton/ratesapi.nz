import { D1Database } from "@cloudflare/workers-types";
import {
  getAvailableDates,
  loadLatestData,
  loadHistoricalData,
  loadTimeSeriesData,
} from "../../lib/data-loader";
import { termsOfUse } from "../../lib/terms-of-use";
import { getCurrentTimestamp } from "../../lib/transforms";
import { CarLoanRates } from "../../models/car-loan-rates";
import { CreditCardRates } from "../../models/credit-card-rates";
import { MortgageRates } from "../../models/mortgage-rates";
import { PersonalLoanRates } from "../../models/personal-loan-rates";
import { McpTool, McpToolCallResult, McpToolContent } from "./types";

/**
 * MCP Tool Definitions
 * Each tool wraps existing API functionality for AI agent consumption
 */
export const MCP_TOOLS: McpTool[] = [
  {
    name: "get_mortgage_rates",
    description:
      "Get the latest mortgage rates from all New Zealand financial institutions. Optionally filter by loan term in months.",
    inputSchema: {
      type: "object",
      properties: {
        termInMonths: {
          type: "string",
          description:
            "Optional mortgage term in months to filter by (e.g., '6', '12', '24', '36')",
          examples: ["6", "12", "24", "36"],
        },
      },
    },
  },
  {
    name: "get_mortgage_rates_by_institution",
    description:
      "Get mortgage rates for a specific New Zealand financial institution. Returns all mortgage products and rates offered by the institution.",
    inputSchema: {
      type: "object",
      properties: {
        institutionId: {
          type: "string",
          description:
            "The institution ID (e.g., 'institution:anz', 'institution:asb', 'institution:bnz', 'institution:kiwibank', 'institution:westpac')",
          examples: [
            "institution:anz",
            "institution:asb",
            "institution:bnz",
            "institution:kiwibank",
            "institution:westpac",
          ],
        },
        termInMonths: {
          type: "string",
          description: "Optional mortgage term in months to filter by",
          examples: ["6", "12", "24", "36"],
        },
      },
      required: ["institutionId"],
    },
  },
  {
    name: "get_mortgage_rates_time_series",
    description:
      "Get historical mortgage rates data for a specific date or date range. Useful for analyzing rate trends over time.",
    inputSchema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Specific date in YYYY-MM-DD format to get rates for",
          examples: ["2025-03-01"],
        },
        startDate: {
          type: "string",
          description: "Start date in YYYY-MM-DD format for a date range query",
          examples: ["2025-01-01"],
        },
        endDate: {
          type: "string",
          description: "End date in YYYY-MM-DD format for a date range query",
          examples: ["2025-03-01"],
        },
        institutionId: {
          type: "string",
          description: "Optional institution ID to filter time series data",
          examples: ["institution:anz"],
        },
        termInMonths: {
          type: "string",
          description: "Optional mortgage term in months to filter by",
          examples: ["12", "24"],
        },
      },
    },
  },
  {
    name: "get_personal_loan_rates",
    description:
      "Get the latest personal loan rates from all New Zealand financial institutions.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_personal_loan_rates_by_institution",
    description:
      "Get personal loan rates for a specific New Zealand financial institution.",
    inputSchema: {
      type: "object",
      properties: {
        institutionId: {
          type: "string",
          description:
            "The institution ID (e.g., 'institution:anz', 'institution:asb')",
          examples: [
            "institution:anz",
            "institution:asb",
            "institution:bnz",
            "institution:kiwibank",
            "institution:westpac",
          ],
        },
      },
      required: ["institutionId"],
    },
  },
  {
    name: "get_personal_loan_rates_time_series",
    description:
      "Get historical personal loan rates data for a specific date or date range.",
    inputSchema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Specific date in YYYY-MM-DD format",
          examples: ["2025-03-01"],
        },
        startDate: {
          type: "string",
          description: "Start date in YYYY-MM-DD format for a date range",
          examples: ["2025-01-01"],
        },
        endDate: {
          type: "string",
          description: "End date in YYYY-MM-DD format for a date range",
          examples: ["2025-03-01"],
        },
        institutionId: {
          type: "string",
          description: "Optional institution ID to filter data",
          examples: ["institution:anz"],
        },
      },
    },
  },
  {
    name: "get_car_loan_rates",
    description:
      "Get the latest car loan rates from all New Zealand financial institutions.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_car_loan_rates_by_institution",
    description:
      "Get car loan rates for a specific New Zealand financial institution.",
    inputSchema: {
      type: "object",
      properties: {
        institutionId: {
          type: "string",
          description:
            "The institution ID (e.g., 'institution:anz', 'institution:asb')",
          examples: [
            "institution:anz",
            "institution:asb",
            "institution:bnz",
            "institution:kiwibank",
            "institution:westpac",
          ],
        },
      },
      required: ["institutionId"],
    },
  },
  {
    name: "get_car_loan_rates_time_series",
    description:
      "Get historical car loan rates data for a specific date or date range.",
    inputSchema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Specific date in YYYY-MM-DD format",
          examples: ["2025-03-01"],
        },
        startDate: {
          type: "string",
          description: "Start date in YYYY-MM-DD format for a date range",
          examples: ["2025-01-01"],
        },
        endDate: {
          type: "string",
          description: "End date in YYYY-MM-DD format for a date range",
          examples: ["2025-03-01"],
        },
        institutionId: {
          type: "string",
          description: "Optional institution ID to filter data",
          examples: ["institution:anz"],
        },
      },
    },
  },
  {
    name: "get_credit_card_rates",
    description:
      "Get the latest credit card interest rates from all New Zealand card issuers.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_credit_card_rates_by_issuer",
    description:
      "Get credit card rates for a specific card issuer in New Zealand.",
    inputSchema: {
      type: "object",
      properties: {
        issuerId: {
          type: "string",
          description: "The issuer ID (e.g., 'issuer:anz', 'issuer:asb')",
          examples: ["issuer:anz", "issuer:asb", "issuer:bnz", "issuer:westpac"],
        },
      },
      required: ["issuerId"],
    },
  },
  {
    name: "get_credit_card_rates_time_series",
    description:
      "Get historical credit card rates data for a specific date or date range.",
    inputSchema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Specific date in YYYY-MM-DD format",
          examples: ["2025-03-01"],
        },
        startDate: {
          type: "string",
          description: "Start date in YYYY-MM-DD format for a date range",
          examples: ["2025-01-01"],
        },
        endDate: {
          type: "string",
          description: "End date in YYYY-MM-DD format for a date range",
          examples: ["2025-03-01"],
        },
        issuerId: {
          type: "string",
          description: "Optional issuer ID to filter data",
          examples: ["issuer:anz"],
        },
      },
    },
  },
  {
    name: "list_available_dates",
    description:
      "Get a list of all available dates for which historical rate data exists. Useful for determining what time periods can be queried.",
    inputSchema: {
      type: "object",
      properties: {
        dataType: {
          type: "string",
          description: "The type of rate data to check available dates for",
          enum: [
            "mortgage-rates",
            "personal-loan-rates",
            "car-loan-rates",
            "credit-card-rates",
          ],
        },
      },
      required: ["dataType"],
    },
  },
];

/**
 * Helper to create a text content response
 */
function textContent(text: string): McpToolContent {
  return { type: "text", text };
}

/**
 * Helper to create a JSON content response
 */
function jsonContent(data: unknown): McpToolContent {
  return { type: "text", text: JSON.stringify(data, null, 2) };
}

/**
 * Helper to create an error response
 */
function errorResult(message: string): McpToolCallResult {
  return {
    content: [textContent(`Error: ${message}`)],
    isError: true,
  };
}

/**
 * Execute an MCP tool
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  db: D1Database
): Promise<McpToolCallResult> {
  try {
    switch (toolName) {
      case "get_mortgage_rates":
        return await getMortgageRates(args, db);
      case "get_mortgage_rates_by_institution":
        return await getMortgageRatesByInstitution(args, db);
      case "get_mortgage_rates_time_series":
        return await getMortgageRatesTimeSeries(args, db);
      case "get_personal_loan_rates":
        return await getPersonalLoanRates(db);
      case "get_personal_loan_rates_by_institution":
        return await getPersonalLoanRatesByInstitution(args, db);
      case "get_personal_loan_rates_time_series":
        return await getPersonalLoanRatesTimeSeries(args, db);
      case "get_car_loan_rates":
        return await getCarLoanRates(db);
      case "get_car_loan_rates_by_institution":
        return await getCarLoanRatesByInstitution(args, db);
      case "get_car_loan_rates_time_series":
        return await getCarLoanRatesTimeSeries(args, db);
      case "get_credit_card_rates":
        return await getCreditCardRates(db);
      case "get_credit_card_rates_by_issuer":
        return await getCreditCardRatesByIssuer(args, db);
      case "get_credit_card_rates_time_series":
        return await getCreditCardRatesTimeSeries(args, db);
      case "list_available_dates":
        return await listAvailableDates(args, db);
      default:
        return errorResult(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResult(message);
  }
}

// ==================== Mortgage Rates Tools ====================

async function getMortgageRates(
  args: Record<string, unknown>,
  db: D1Database
): Promise<McpToolCallResult> {
  const termInMonths = args.termInMonths as string | undefined;
  const mortgageRates = await loadLatestData<MortgageRates>(
    "mortgage-rates",
    db
  );

  let data = mortgageRates.data;

  if (termInMonths) {
    data = data.map((institution) => ({
      ...institution,
      products: institution.products
        .map((product) => ({
          ...product,
          rates: product.rates.filter(
            (rate) => rate.termInMonths === parseInt(termInMonths)
          ),
        }))
        .filter((product) => product.rates.length > 0),
    }));
  }

  return {
    content: [
      jsonContent({
        ...mortgageRates,
        data,
        termsOfUse: termsOfUse(),
        timestamp: getCurrentTimestamp(),
      }),
    ],
  };
}

async function getMortgageRatesByInstitution(
  args: Record<string, unknown>,
  db: D1Database
): Promise<McpToolCallResult> {
  const institutionId = args.institutionId as string;
  const termInMonths = args.termInMonths as string | undefined;

  if (!institutionId) {
    return errorResult("institutionId is required");
  }

  const mortgageRates = await loadLatestData<MortgageRates>(
    "mortgage-rates",
    db
  );

  const institution = mortgageRates.data.find(
    (i) => i.id.toLowerCase() === institutionId.toLowerCase()
  );

  if (!institution) {
    return errorResult(`Institution not found: ${institutionId}`);
  }

  let filteredInstitution = institution;

  if (termInMonths) {
    filteredInstitution = {
      ...institution,
      products: institution.products
        .map((product) => ({
          ...product,
          rates: product.rates.filter(
            (rate) => rate.termInMonths === parseInt(termInMonths)
          ),
        }))
        .filter((product) => product.rates.length > 0),
    };
  }

  return {
    content: [
      jsonContent({
        ...mortgageRates,
        data: [filteredInstitution],
        termsOfUse: termsOfUse(),
        timestamp: getCurrentTimestamp(),
      }),
    ],
  };
}

async function getMortgageRatesTimeSeries(
  args: Record<string, unknown>,
  db: D1Database
): Promise<McpToolCallResult> {
  const date = args.date as string | undefined;
  const startDate = args.startDate as string | undefined;
  const endDate = args.endDate as string | undefined;
  const institutionId = args.institutionId as string | undefined;
  const termInMonths = args.termInMonths as string | undefined;

  const availableDates = await getAvailableDates("mortgage-rates", db);

  if (availableDates.length === 0) {
    return errorResult("No historical data available");
  }

  if (date) {
    const historicalData = await loadHistoricalData<MortgageRates>(
      "mortgage-rates",
      date,
      db
    );

    if (!historicalData) {
      return errorResult(`No data available for date: ${date}`);
    }

    let filteredData = historicalData;

    if (institutionId) {
      filteredData = {
        ...filteredData,
        data: filteredData.data.filter(
          (inst) => inst.id.toLowerCase() === institutionId.toLowerCase()
        ),
      };
    }

    if (termInMonths) {
      filteredData = {
        ...filteredData,
        data: filteredData.data.map((institution) => ({
          ...institution,
          products: institution.products
            .map((product) => ({
              ...product,
              rates: product.rates.filter(
                (rate) => rate.termInMonths === parseInt(termInMonths)
              ),
            }))
            .filter((product) => product.rates.length > 0),
        })),
      };
    }

    return {
      content: [
        jsonContent({
          type: "MortgageRatesTimeSeries",
          timeSeries: { [date]: filteredData },
          availableDates,
          termsOfUse: termsOfUse(),
          timestamp: getCurrentTimestamp(),
        }),
      ],
    };
  }

  if (startDate && endDate) {
    if (startDate > endDate) {
      return errorResult("Start date cannot be after end date");
    }

    const timeSeriesData = await loadTimeSeriesData<MortgageRates>(
      "mortgage-rates",
      startDate,
      endDate,
      db
    );

    if (Object.keys(timeSeriesData).length === 0) {
      return errorResult(
        `No data available between ${startDate} and ${endDate}`
      );
    }

    return {
      content: [
        jsonContent({
          type: "MortgageRatesTimeSeries",
          timeSeries: timeSeriesData,
          availableDates,
          termsOfUse: termsOfUse(),
          timestamp: getCurrentTimestamp(),
        }),
      ],
    };
  }

  return {
    content: [
      jsonContent({
        type: "MortgageRatesTimeSeries",
        timeSeries: {},
        availableDates,
        message:
          "Please specify a date or date range (startDate and endDate) to retrieve time series data",
        termsOfUse: termsOfUse(),
        timestamp: getCurrentTimestamp(),
      }),
    ],
  };
}

// ==================== Personal Loan Rates Tools ====================

async function getPersonalLoanRates(
  db: D1Database
): Promise<McpToolCallResult> {
  const personalLoanRates = await loadLatestData<PersonalLoanRates>(
    "personal-loan-rates",
    db
  );

  return {
    content: [
      jsonContent({
        ...personalLoanRates,
        termsOfUse: termsOfUse(),
        timestamp: getCurrentTimestamp(),
      }),
    ],
  };
}

async function getPersonalLoanRatesByInstitution(
  args: Record<string, unknown>,
  db: D1Database
): Promise<McpToolCallResult> {
  const institutionId = args.institutionId as string;

  if (!institutionId) {
    return errorResult("institutionId is required");
  }

  const personalLoanRates = await loadLatestData<PersonalLoanRates>(
    "personal-loan-rates",
    db
  );

  const institution = personalLoanRates.data.find(
    (i) => i.id.toLowerCase() === institutionId.toLowerCase()
  );

  if (!institution) {
    return errorResult(`Institution not found: ${institutionId}`);
  }

  return {
    content: [
      jsonContent({
        ...personalLoanRates,
        data: [institution],
        termsOfUse: termsOfUse(),
        timestamp: getCurrentTimestamp(),
      }),
    ],
  };
}

async function getPersonalLoanRatesTimeSeries(
  args: Record<string, unknown>,
  db: D1Database
): Promise<McpToolCallResult> {
  const date = args.date as string | undefined;
  const startDate = args.startDate as string | undefined;
  const endDate = args.endDate as string | undefined;
  const institutionId = args.institutionId as string | undefined;

  const availableDates = await getAvailableDates("personal-loan-rates", db);

  if (availableDates.length === 0) {
    return errorResult("No historical data available");
  }

  if (date) {
    const historicalData = await loadHistoricalData<PersonalLoanRates>(
      "personal-loan-rates",
      date,
      db
    );

    if (!historicalData) {
      return errorResult(`No data available for date: ${date}`);
    }

    let filteredData = historicalData;

    if (institutionId) {
      filteredData = {
        ...filteredData,
        data: filteredData.data.filter(
          (inst) => inst.id.toLowerCase() === institutionId.toLowerCase()
        ),
      };
    }

    return {
      content: [
        jsonContent({
          type: "PersonalLoanRatesTimeSeries",
          timeSeries: { [date]: filteredData },
          availableDates,
          termsOfUse: termsOfUse(),
          timestamp: getCurrentTimestamp(),
        }),
      ],
    };
  }

  if (startDate && endDate) {
    if (startDate > endDate) {
      return errorResult("Start date cannot be after end date");
    }

    const timeSeriesData = await loadTimeSeriesData<PersonalLoanRates>(
      "personal-loan-rates",
      startDate,
      endDate,
      db
    );

    if (Object.keys(timeSeriesData).length === 0) {
      return errorResult(
        `No data available between ${startDate} and ${endDate}`
      );
    }

    return {
      content: [
        jsonContent({
          type: "PersonalLoanRatesTimeSeries",
          timeSeries: timeSeriesData,
          availableDates,
          termsOfUse: termsOfUse(),
          timestamp: getCurrentTimestamp(),
        }),
      ],
    };
  }

  return {
    content: [
      jsonContent({
        type: "PersonalLoanRatesTimeSeries",
        timeSeries: {},
        availableDates,
        message:
          "Please specify a date or date range (startDate and endDate) to retrieve time series data",
        termsOfUse: termsOfUse(),
        timestamp: getCurrentTimestamp(),
      }),
    ],
  };
}

// ==================== Car Loan Rates Tools ====================

async function getCarLoanRates(db: D1Database): Promise<McpToolCallResult> {
  const carLoanRates = await loadLatestData<CarLoanRates>("car-loan-rates", db);

  return {
    content: [
      jsonContent({
        ...carLoanRates,
        termsOfUse: termsOfUse(),
        timestamp: getCurrentTimestamp(),
      }),
    ],
  };
}

async function getCarLoanRatesByInstitution(
  args: Record<string, unknown>,
  db: D1Database
): Promise<McpToolCallResult> {
  const institutionId = args.institutionId as string;

  if (!institutionId) {
    return errorResult("institutionId is required");
  }

  const carLoanRates = await loadLatestData<CarLoanRates>("car-loan-rates", db);

  const institution = carLoanRates.data.find(
    (i) => i.id.toLowerCase() === institutionId.toLowerCase()
  );

  if (!institution) {
    return errorResult(`Institution not found: ${institutionId}`);
  }

  return {
    content: [
      jsonContent({
        ...carLoanRates,
        data: [institution],
        termsOfUse: termsOfUse(),
        timestamp: getCurrentTimestamp(),
      }),
    ],
  };
}

async function getCarLoanRatesTimeSeries(
  args: Record<string, unknown>,
  db: D1Database
): Promise<McpToolCallResult> {
  const date = args.date as string | undefined;
  const startDate = args.startDate as string | undefined;
  const endDate = args.endDate as string | undefined;
  const institutionId = args.institutionId as string | undefined;

  const availableDates = await getAvailableDates("car-loan-rates", db);

  if (availableDates.length === 0) {
    return errorResult("No historical data available");
  }

  if (date) {
    const historicalData = await loadHistoricalData<CarLoanRates>(
      "car-loan-rates",
      date,
      db
    );

    if (!historicalData) {
      return errorResult(`No data available for date: ${date}`);
    }

    let filteredData = historicalData;

    if (institutionId) {
      filteredData = {
        ...filteredData,
        data: filteredData.data.filter(
          (inst) => inst.id.toLowerCase() === institutionId.toLowerCase()
        ),
      };
    }

    return {
      content: [
        jsonContent({
          type: "CarLoanRatesTimeSeries",
          timeSeries: { [date]: filteredData },
          availableDates,
          termsOfUse: termsOfUse(),
          timestamp: getCurrentTimestamp(),
        }),
      ],
    };
  }

  if (startDate && endDate) {
    if (startDate > endDate) {
      return errorResult("Start date cannot be after end date");
    }

    const timeSeriesData = await loadTimeSeriesData<CarLoanRates>(
      "car-loan-rates",
      startDate,
      endDate,
      db
    );

    if (Object.keys(timeSeriesData).length === 0) {
      return errorResult(
        `No data available between ${startDate} and ${endDate}`
      );
    }

    return {
      content: [
        jsonContent({
          type: "CarLoanRatesTimeSeries",
          timeSeries: timeSeriesData,
          availableDates,
          termsOfUse: termsOfUse(),
          timestamp: getCurrentTimestamp(),
        }),
      ],
    };
  }

  return {
    content: [
      jsonContent({
        type: "CarLoanRatesTimeSeries",
        timeSeries: {},
        availableDates,
        message:
          "Please specify a date or date range (startDate and endDate) to retrieve time series data",
        termsOfUse: termsOfUse(),
        timestamp: getCurrentTimestamp(),
      }),
    ],
  };
}

// ==================== Credit Card Rates Tools ====================

async function getCreditCardRates(db: D1Database): Promise<McpToolCallResult> {
  const creditCardRates = await loadLatestData<CreditCardRates>(
    "credit-card-rates",
    db
  );

  return {
    content: [
      jsonContent({
        ...creditCardRates,
        termsOfUse: termsOfUse(),
        timestamp: getCurrentTimestamp(),
      }),
    ],
  };
}

async function getCreditCardRatesByIssuer(
  args: Record<string, unknown>,
  db: D1Database
): Promise<McpToolCallResult> {
  const issuerId = args.issuerId as string;

  if (!issuerId) {
    return errorResult("issuerId is required");
  }

  const creditCardRates = await loadLatestData<CreditCardRates>(
    "credit-card-rates",
    db
  );

  const issuer = creditCardRates.data.find(
    (i) => i.id.toLowerCase() === issuerId.toLowerCase()
  );

  if (!issuer) {
    return errorResult(`Issuer not found: ${issuerId}`);
  }

  return {
    content: [
      jsonContent({
        ...creditCardRates,
        data: [issuer],
        termsOfUse: termsOfUse(),
        timestamp: getCurrentTimestamp(),
      }),
    ],
  };
}

async function getCreditCardRatesTimeSeries(
  args: Record<string, unknown>,
  db: D1Database
): Promise<McpToolCallResult> {
  const date = args.date as string | undefined;
  const startDate = args.startDate as string | undefined;
  const endDate = args.endDate as string | undefined;
  const issuerId = args.issuerId as string | undefined;

  const availableDates = await getAvailableDates("credit-card-rates", db);

  if (availableDates.length === 0) {
    return errorResult("No historical data available");
  }

  if (date) {
    const historicalData = await loadHistoricalData<CreditCardRates>(
      "credit-card-rates",
      date,
      db
    );

    if (!historicalData) {
      return errorResult(`No data available for date: ${date}`);
    }

    let filteredData = historicalData;

    if (issuerId) {
      filteredData = {
        ...filteredData,
        data: filteredData.data.filter(
          (iss) => iss.id.toLowerCase() === issuerId.toLowerCase()
        ),
      };
    }

    return {
      content: [
        jsonContent({
          type: "CreditCardRatesTimeSeries",
          timeSeries: { [date]: filteredData },
          availableDates,
          termsOfUse: termsOfUse(),
          timestamp: getCurrentTimestamp(),
        }),
      ],
    };
  }

  if (startDate && endDate) {
    if (startDate > endDate) {
      return errorResult("Start date cannot be after end date");
    }

    const timeSeriesData = await loadTimeSeriesData<CreditCardRates>(
      "credit-card-rates",
      startDate,
      endDate,
      db
    );

    if (Object.keys(timeSeriesData).length === 0) {
      return errorResult(
        `No data available between ${startDate} and ${endDate}`
      );
    }

    return {
      content: [
        jsonContent({
          type: "CreditCardRatesTimeSeries",
          timeSeries: timeSeriesData,
          availableDates,
          termsOfUse: termsOfUse(),
          timestamp: getCurrentTimestamp(),
        }),
      ],
    };
  }

  return {
    content: [
      jsonContent({
        type: "CreditCardRatesTimeSeries",
        timeSeries: {},
        availableDates,
        message:
          "Please specify a date or date range (startDate and endDate) to retrieve time series data",
        termsOfUse: termsOfUse(),
        timestamp: getCurrentTimestamp(),
      }),
    ],
  };
}

// ==================== Utility Tools ====================

async function listAvailableDates(
  args: Record<string, unknown>,
  db: D1Database
): Promise<McpToolCallResult> {
  const dataType = args.dataType as string;

  if (!dataType) {
    return errorResult("dataType is required");
  }

  const validTypes = [
    "mortgage-rates",
    "personal-loan-rates",
    "car-loan-rates",
    "credit-card-rates",
  ];

  if (!validTypes.includes(dataType)) {
    return errorResult(
      `Invalid dataType. Must be one of: ${validTypes.join(", ")}`
    );
  }

  const availableDates = await getAvailableDates(
    dataType as "mortgage-rates" | "personal-loan-rates" | "car-loan-rates" | "credit-card-rates",
    db
  );

  return {
    content: [
      jsonContent({
        dataType,
        availableDates,
        count: availableDates.length,
        termsOfUse: termsOfUse(),
        timestamp: getCurrentTimestamp(),
      }),
    ],
  };
}
