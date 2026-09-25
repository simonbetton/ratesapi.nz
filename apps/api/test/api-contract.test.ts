import { describe, expect, test } from "bun:test";

import { createApp } from "../src/app";
import { toSavableJson } from "../src/lib/data-loader";
import type { DataType, SupportedModels } from "../src/lib/data-loader";
import type { Environment } from "../src/lib/environment";
import { parseSchema } from "../src/lib/schema";
import { HealthResponse } from "../src/models/api";
import type { CarLoanRates } from "../src/models/car-loan-rates";
import type { CreditCardRates } from "../src/models/credit-card-rates";
import type { MortgageRates } from "../src/models/mortgage-rates";
import type { PersonalLoanRates } from "../src/models/personal-loan-rates";
import {
  CarLoanRatesResponse,
  CreditCardRatesResponse,
  MortgageRatesResponse,
  MortgageRatesTimeSeriesResponse,
  PersonalLoanRatesResponse,
} from "../src/models/responses";

type ListResponseType =
  | "MortgageRates"
  | "PersonalLoanRates"
  | "CarLoanRates"
  | "CreditCardRates";

type ListSchema =
  | typeof MortgageRatesResponse
  | typeof PersonalLoanRatesResponse
  | typeof CarLoanRatesResponse
  | typeof CreditCardRatesResponse;

interface ListCase {
  path: string;
  type: ListResponseType;
  schema: ListSchema;
}

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

describe("v1 API contract", () => {
  const listCases: ListCase[] = [
    {
      path: "/api/v1/mortgage-rates",
      type: "MortgageRates",
      schema: MortgageRatesResponse,
    },
    {
      path: "/api/v1/personal-loan-rates",
      type: "PersonalLoanRates",
      schema: PersonalLoanRatesResponse,
    },
    {
      path: "/api/v1/car-loan-rates",
      type: "CarLoanRates",
      schema: CarLoanRatesResponse,
    },
    {
      path: "/api/v1/credit-card-rates",
      type: "CreditCardRates",
      schema: CreditCardRatesResponse,
    },
  ];

  for (const { path, type, schema } of listCases) {
    test(`returns the existing successful ${type} list shape`, async () => {
      const response = await request(path);

      expect(response.status).toBe(200);

      const body = parseSchema(schema, await jsonBody(response));

      expect(body.type).toBe(type);
      expect(body.lastUpdated).toBe("2026-04-30T00:00:00.000Z");
      expect(body.data.length).toBe(1);
      expect(typeof body.termsOfUse).toBe("string");
      expect(typeof body.timestamp).toBe("string");
    });

    test(`serves the ${type} list with a trailing slash`, async () => {
      const response = await request(`${path}/`);

      expect(response.status).toBe(200);
      expect(parseSchema(schema, await jsonBody(response)).type).toBe(type);
    });
  }

  test("returns the existing successful mortgage list shape", async () => {
    const response = await request("/api/v1/mortgage-rates");

    expect(response.status).toBe(200);
    expect(typeof response.headers.get("x-request-id")).toBe("string");

    const body = parseSchema(MortgageRatesResponse, await jsonBody(response));

    expect(body.type).toBe("MortgageRates");
    expect(body.lastUpdated).toBe("2026-04-30T00:00:00.000Z");
    expect(typeof body.termsOfUse).toBe("string");
    expect(typeof body.timestamp).toBe("string");
    expect(body.data).toEqual(mortgageRates.data);
  });

  test("keeps mortgage term filtering shape unchanged", async () => {
    const response = await request("/api/v1/mortgage-rates?termInMonths=12");

    expect(response.status).toBe(200);

    const body = parseSchema(MortgageRatesResponse, await jsonBody(response));

    expect(body.type).toBe("MortgageRates");
    expect(body.lastUpdated).toBe("2026-04-30T00:00:00.000Z");
    expect(body.data[0]?.products[0]?.rates).toEqual([
      {
        id: "rate:anz:standard:1-year",
        rate: 6.49,
        term: "1 year",
        termInMonths: 12,
      },
    ]);
  });

  test("returns the existing successful time-series discovery shape", async () => {
    const response = await request("/api/v1/mortgage-rates/time-series");

    expect(response.status).toBe(200);

    const body = parseSchema(
      MortgageRatesTimeSeriesResponse,
      await jsonBody(response)
    );

    expect(body.type).toBe("MortgageRatesTimeSeries");
    expect(body.timeSeries).toEqual({});
    expect(body.availableDates).toEqual(["2026-04-30"]);
    expect(typeof body.termsOfUse).toBe("string");
    expect(typeof body.timestamp).toBe("string");
    expect(body.message).toBe(
      "Please specify a date or date range to retrieve time series data"
    );
  });

  test("returns historical mortgage data with the same nested data shape", async () => {
    const response = await request(
      "/api/v1/mortgage-rates/time-series?date=2026-04-30&institutionId=institution:anz&termInMonths=12"
    );

    expect(response.status).toBe(200);

    const body = parseSchema(
      MortgageRatesTimeSeriesResponse,
      await jsonBody(response)
    );
    const day = body.timeSeries["2026-04-30"];

    expect(body.type).toBe("MortgageRatesTimeSeries");
    expect(day).toBeDefined();
    if (!day) {
      throw new Error("Expected historical day in time series response");
    }
    expect(day.type).toBe("MortgageRates");
    expect(day.lastUpdated).toBe("2026-04-30T00:00:00.000Z");
    expect(day.data[0]?.products[0]?.rates).toEqual([
      {
        id: "rate:anz:standard:1-year",
        rate: 6.49,
        term: "1 year",
        termInMonths: 12,
      },
    ]);
  });

  test("returns validation errors as 400s instead of server errors", async () => {
    const response = await request(
      "/api/v1/mortgage-rates/time-series?date=2026-02-30"
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 400,
      message: "Invalid request parameters",
    });
  });

  test("exposes data freshness through health", async () => {
    const response = await request("/api/v1/health");

    expect(response.status).toBe(200);
    const body = parseSchema(HealthResponse, await jsonBody(response));

    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
    expect(body.dataSets).toContainEqual({
      dataType: "mortgage-rates",
      lastUpdated: "2026-04-30 00:00:00",
    });
  });

  test("leaves root documentation pages to the docs app", async () => {
    const response = await request("/");

    expect(response.status).toBe(404);
  });

  test("leaves API reference documentation pages to the docs app", async () => {
    const response = await request(
      "/api-reference/endpoint/mortgage-rates/time-series"
    );

    expect(response.status).toBe(404);
  });

  test("leaves open-source documentation pages to the docs app", async () => {
    const response = await request("/open-source/deployment");

    expect(response.status).toBe(404);
  });

  test("leaves LLM documentation index to the docs app", async () => {
    const response = await request("/llms.txt");

    expect(response.status).toBe(404);
  });

  test("leaves documentation search to the docs app", async () => {
    const response = await request(
      "/api/search?query=mortgage%20time%20series"
    );

    expect(response.status).toBe(404);
  });

  test("exposes OpenAPI UI and JSON without documenting MCP", async () => {
    const uiResponse = await request("/openapi");
    expect(uiResponse.status).toBe(200);

    const specResponse = await request("/openapi/json");
    expect(specResponse.status).toBe(200);

    const spec = requireRecord(await jsonBody(specResponse));
    const info = readRecord(spec, "info");
    const paths = readRecord(spec, "paths");
    const servers = readArray(spec, "servers");
    const defaultServer = readRecord(servers[0], "self");

    expect(info?.title).toBe("Rates API");
    expect(defaultServer?.url).toBe("http://localhost");
    expect(defaultServer?.description).toBe("Local");
    expect(paths?.["/api/v1/mortgage-rates"]).toBeDefined();
    expect(paths?.["/api/v1/mcp/"]).toBeUndefined();
    expect(
      Object.keys(paths ?? {}).filter((path) => path.endsWith("/"))
    ).toEqual([]);
  });

  test("documents every OpenAPI operation, parameter, and response", async () => {
    const specResponse = await request("/openapi/json");
    const spec = requireRecord(await jsonBody(specResponse));
    const tags = readArray(spec, "tags").map((tag) => readRecord(tag, "self"));
    const tagNames = tags.map((tag) => tag?.name);
    const operations = Object.values(readRecord(spec, "paths") ?? {}).flatMap(
      (pathItem) => Object.values(requireRecord(pathItem)).map(requireRecord)
    );
    const problems = [
      ...tags.flatMap((tag) =>
        typeof tag?.description === "string"
          ? []
          : [`tag ${String(tag?.name)} has no description`]
      ),
      ...operations.flatMap((operation) =>
        findOperationDocumentationProblems(operation, tagNames)
      ),
    ];

    expect(spec.openapi).toBe("3.1.0");
    expect(JSON.stringify(spec)).not.toContain('"nullable"');
    expect(operations.length).toBe(13);
    expect(problems).toEqual([]);
  });

  test("uses the production server as the OpenAPI default in production", async () => {
    const specResponse = await requestWithEnv(
      createProductionEnv,
      "/openapi/json",
      "https://ratesapi.nz"
    );
    expect(specResponse.status).toBe(200);

    const spec = requireRecord(await jsonBody(specResponse));
    const servers = readArray(spec, "servers");
    const defaultServer = readRecord(servers[0], "self");

    expect(defaultServer?.url).toBe("https://ratesapi.nz");
    expect(defaultServer?.description).toBe("Production");
  });

  test("handles CORS preflight for API routes", async () => {
    const response = await request("/api/v1/mortgage-rates", {
      method: "OPTIONS",
      headers: {
        origin: "https://example.com",
        "access-control-request-method": "GET",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-max-age")).toBe("600");
  });

  test("handles MCP initialize, tools list, and tool call", async () => {
    const initializeResponse = await request("/api/v1/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
      }),
    });

    expect(initializeResponse.status).toBe(200);
    await expect(initializeResponse.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        serverInfo: {
          name: "ratesapi-mcp",
        },
      },
    });

    const toolsResponse = await request("/api/v1/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      }),
    });

    expect(toolsResponse.status).toBe(200);
    const toolsBody = requireRecord(await jsonBody(toolsResponse));
    const toolsResult = readRecord(toolsBody, "result");
    const tools = readArray(toolsResult, "tools");
    const toolNames = tools
      .map((tool) => readRecord(tool, "self")?.name)
      .filter((name): name is string => typeof name === "string");
    expect(toolNames).toContain("list_mortgage_rates");

    const callResponse = await request("/api/v1/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "list_mortgage_rates",
          arguments: {
            termInMonths: "12",
          },
        },
      }),
    });

    expect(callResponse.status).toBe(200);
    const callBody = requireRecord(await jsonBody(callResponse));
    const callResult = readRecord(callBody, "result");
    const content = readArray(callResult, "content");
    const [firstContent] = content;
    const text = readRecord(firstContent, "self")?.text;
    if (typeof text !== "string") {
      throw new TypeError("Expected MCP tool call to return text content");
    }

    const parsedText: unknown = JSON.parse(text);
    expect(parsedText).toMatchObject({
      type: "MortgageRates",
      data: [
        {
          products: [
            {
              rates: [
                {
                  termInMonths: 12,
                },
              ],
            },
          ],
        },
      ],
    });
  });
});

// The hand-authored shape MCP_TOOLS advertises. Kept here
// (not imported) so the test fails if the discovery output's shape drifts,
// including if a TypeBox-derived schema were to leak internal keys: an HTTP
// JSON response can never carry the TypeBox.Kind/Optional symbols, but this
// also confirms every enumerable field still matches exactly.
const EXPECTED_MCP_TOOLS: unknown[] = [
  {
    name: "list_mortgage_rates",
    title: "List mortgage rates",
    description: "List latest mortgage rates for all institutions.",
    inputSchema: {
      type: "object",
      properties: {
        termInMonths: {
          type: "string",
          description: "Optional mortgage term in months to filter by.",
          examples: ["6", "12", "24", "36"],
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_mortgage_rates_by_institution",
    title: "Get mortgage rates for one institution",
    description: "Get latest mortgage rates for a specific institution.",
    inputSchema: {
      type: "object",
      properties: {
        institutionId: {
          type: "string",
          description: "Institution ID to filter by.",
          examples: ["institution:anz"],
        },
        termInMonths: {
          type: "string",
          description: "Optional mortgage term in months to filter by.",
          examples: ["6", "12", "24", "36"],
        },
      },
      required: ["institutionId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_mortgage_rates_time_series",
    title: "Get historical mortgage rates",
    description: "Get mortgage rates time series for a date or range.",
    inputSchema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format for historical data.",
          examples: ["2025-03-01"],
        },
        startDate: {
          type: "string",
          description: "Start date in YYYY-MM-DD format for time series.",
          examples: ["2025-01-01"],
        },
        endDate: {
          type: "string",
          description: "End date in YYYY-MM-DD format for time series.",
          examples: ["2025-03-01"],
        },
        institutionId: {
          type: "string",
          description: "Optional institution ID to filter time series data.",
          examples: ["institution:anz"],
        },
        termInMonths: {
          type: "string",
          description: "Optional mortgage term in months to filter by.",
          examples: ["6", "12", "24", "36"],
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "list_personal_loan_rates",
    title: "List personal loan rates",
    description: "List latest personal loan rates for all institutions.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_personal_loan_rates_by_institution",
    title: "Get personal loan rates for one institution",
    description: "Get latest personal loan rates for a specific institution.",
    inputSchema: {
      type: "object",
      properties: {
        institutionId: {
          type: "string",
          description: "Institution ID to filter by.",
          examples: ["institution:anz"],
        },
      },
      required: ["institutionId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_personal_loan_rates_time_series",
    title: "Get historical personal loan rates",
    description: "Get personal loan rates time series for a date or range.",
    inputSchema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format for historical data.",
          examples: ["2025-03-01"],
        },
        startDate: {
          type: "string",
          description: "Start date in YYYY-MM-DD format for time series.",
          examples: ["2025-01-01"],
        },
        endDate: {
          type: "string",
          description: "End date in YYYY-MM-DD format for time series.",
          examples: ["2025-03-01"],
        },
        institutionId: {
          type: "string",
          description: "Optional institution ID to filter time series data.",
          examples: ["institution:anz"],
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "list_car_loan_rates",
    title: "List car loan rates",
    description: "List latest car loan rates for all institutions.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_car_loan_rates_by_institution",
    title: "Get car loan rates for one institution",
    description: "Get latest car loan rates for a specific institution.",
    inputSchema: {
      type: "object",
      properties: {
        institutionId: {
          type: "string",
          description: "Institution ID to filter by.",
          examples: ["institution:anz"],
        },
      },
      required: ["institutionId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_car_loan_rates_time_series",
    title: "Get historical car loan rates",
    description: "Get car loan rates time series for a date or range.",
    inputSchema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format for historical data.",
          examples: ["2025-03-01"],
        },
        startDate: {
          type: "string",
          description: "Start date in YYYY-MM-DD format for time series.",
          examples: ["2025-01-01"],
        },
        endDate: {
          type: "string",
          description: "End date in YYYY-MM-DD format for time series.",
          examples: ["2025-03-01"],
        },
        institutionId: {
          type: "string",
          description: "Optional institution ID to filter time series data.",
          examples: ["institution:anz"],
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "list_credit_card_rates",
    title: "List credit card rates",
    description: "List latest credit card rates for all issuers.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_credit_card_rates_by_issuer",
    title: "Get credit card rates for one issuer",
    description: "Get latest credit card rates for a specific issuer.",
    inputSchema: {
      type: "object",
      properties: {
        issuerId: {
          type: "string",
          description: "Issuer ID to filter by.",
          examples: ["issuer:anz"],
        },
      },
      required: ["issuerId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_credit_card_rates_time_series",
    title: "Get historical credit card rates",
    description: "Get credit card rates time series for a date or range.",
    inputSchema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format for historical data.",
          examples: ["2025-03-01"],
        },
        startDate: {
          type: "string",
          description: "Start date in YYYY-MM-DD format for time series.",
          examples: ["2025-01-01"],
        },
        endDate: {
          type: "string",
          description: "End date in YYYY-MM-DD format for time series.",
          examples: ["2025-03-01"],
        },
        issuerId: {
          type: "string",
          description: "Optional issuer ID to filter time series data.",
          examples: ["issuer:anz"],
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

describe("MCP tools/list discovery shape", () => {
  test("advertises tool schemas with unchanged shape and no internal keys", async () => {
    const response = await request("/api/v1/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      }),
    });

    expect(response.status).toBe(200);
    const body = requireRecord(await jsonBody(response));
    const result = readRecord(body, "result");
    const tools = readArray(result, "tools");

    expect(tools).toEqual(EXPECTED_MCP_TOOLS);
  });
});

describe("MCP envelope validation", () => {
  test("rejects an object id, recovering a null id", async () => {
    const response = await mcpRequest(createEnv, {
      jsonrpc: "2.0",
      method: "ping",
      id: { nested: true },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32_600 },
    });
  });

  test("rejects a boolean id, recovering a null id", async () => {
    const response = await mcpRequest(createEnv, {
      jsonrpc: "2.0",
      method: "ping",
      id: true,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32_600 },
    });
  });

  test("rejects a primitive envelope instead of crashing", async () => {
    const response = await mcpRequest(createEnv, "just a string");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32_600 },
    });
  });

  test("answers each invalid member of a legacy batch instead of crashing", async () => {
    // 2025-03-26 clients (no MCP-Protocol-Version header) may send batches.
    const response = await mcpRequest(createEnv, [1, 2, 3]);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(3);
    expect(body).toEqual(
      Array.from({ length: 3 }, () =>
        expect.objectContaining({
          id: null,
          error: expect.objectContaining({ code: -32_600 }),
        })
      )
    );
  });

  test("rejects a missing jsonrpc version but still echoes a recoverable id", async () => {
    const response = await mcpRequest(createEnv, {
      method: "ping",
      id: 5,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 5,
      error: { code: -32_600 },
    });
  });

  test("rejects an unsupported jsonrpc version but still echoes a recoverable id", async () => {
    const response = await mcpRequest(createEnv, {
      jsonrpc: "1.0",
      method: "ping",
      id: "abc",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: "abc",
      error: { code: -32_600 },
    });
  });

  test("rejects a missing method but still echoes a recoverable id", async () => {
    const response = await mcpRequest(createEnv, {
      jsonrpc: "2.0",
      id: 7,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 7,
      error: { code: -32_600 },
    });
  });

  test("keeps returning a parse error for malformed JSON", async () => {
    const response = await mcpRequest(createEnv, undefined, {
      raw: "{not valid json",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32_700 },
    });
  });

  test("accepts a notification (no id key) with 202 and no body", async () => {
    const response = await mcpRequest(createEnv, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

    expect(response.status).toBe(202);
    expect(await response.text()).toBe("");
  });

  test("does not dispatch a notification, even for a method that would fail", async () => {
    const spy = createSpyEnv();
    const response = await mcpRequest(spy.getEnv, {
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "list_mortgage_rates" },
    });

    expect(response.status).toBe(202);
    expect(spy.getCallCount()).toBe(0);
  });

  test("treats request id 0 as a real request, not a notification", async () => {
    const response = await mcpRequest(createEnv, {
      jsonrpc: "2.0",
      method: "ping",
      id: 0,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 0,
      result: {},
    });
  });

  test("treats an explicit null id as a real request, not a notification", async () => {
    const response = await mcpRequest(createEnv, {
      jsonrpc: "2.0",
      method: "ping",
      id: null,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: null,
      result: {},
    });
  });
});

interface ToolValidArgsCase {
  tool: string;
  args?: Record<string, unknown>;
}

const validToolArgsCases: ToolValidArgsCase[] = [
  { tool: "list_mortgage_rates" },
  { tool: "list_mortgage_rates", args: { termInMonths: "12" } },
  {
    tool: "get_mortgage_rates_by_institution",
    args: { institutionId: "institution:anz" },
  },
  { tool: "get_mortgage_rates_time_series" },
  { tool: "list_personal_loan_rates" },
  {
    tool: "get_personal_loan_rates_by_institution",
    args: { institutionId: "institution:asb" },
  },
  { tool: "get_personal_loan_rates_time_series" },
  { tool: "list_car_loan_rates" },
  {
    tool: "get_car_loan_rates_by_institution",
    args: { institutionId: "institution:asb" },
  },
  { tool: "get_car_loan_rates_time_series" },
  { tool: "list_credit_card_rates" },
  {
    tool: "get_credit_card_rates_by_issuer",
    args: { issuerId: "issuer:amex" },
  },
  { tool: "get_credit_card_rates_time_series" },
];

interface ToolInvalidArgsCase {
  tool: string;
  description: string;
  args: unknown;
}

const invalidToolArgsCases: ToolInvalidArgsCase[] = [
  {
    tool: "list_mortgage_rates",
    description: "rejects a numeric termInMonths instead of a string",
    args: { termInMonths: 12 },
  },
  {
    tool: "list_mortgage_rates",
    description: "rejects an unknown property",
    args: { termInMonths: "12", unexpected: true },
  },
  {
    tool: "get_mortgage_rates_by_institution",
    description: "rejects a missing required institutionId",
    args: {},
  },
  {
    tool: "get_mortgage_rates_by_institution",
    description: "rejects a numeric institutionId",
    args: { institutionId: 12_345 },
  },
  {
    tool: "get_mortgage_rates_time_series",
    description: "rejects a numeric date",
    args: { date: 20_250_301 },
  },
  {
    tool: "list_personal_loan_rates",
    description: "rejects an unknown property on an argument-free tool",
    args: { unexpected: true },
  },
  {
    tool: "list_personal_loan_rates",
    description: "rejects an array instead of an object",
    args: [],
  },
  {
    tool: "get_personal_loan_rates_by_institution",
    description: "rejects a missing required institutionId",
    args: {},
  },
  {
    tool: "get_personal_loan_rates_time_series",
    description: "rejects an array value for a string field",
    args: { date: ["2025-01-01"] },
  },
  {
    tool: "list_car_loan_rates",
    description: "rejects an unknown property on an argument-free tool",
    args: { unexpected: true },
  },
  {
    tool: "get_car_loan_rates_by_institution",
    description: "rejects a missing required institutionId",
    args: {},
  },
  {
    tool: "get_car_loan_rates_time_series",
    description: "rejects a boolean value for a string field",
    args: { institutionId: true },
  },
  {
    tool: "list_credit_card_rates",
    description: "rejects an unknown property on an argument-free tool",
    args: { unexpected: true },
  },
  {
    tool: "get_credit_card_rates_by_issuer",
    description: "rejects a missing required issuerId",
    args: {},
  },
  {
    tool: "get_credit_card_rates_by_issuer",
    description: "rejects a numeric issuerId",
    args: { issuerId: 5 },
  },
  {
    tool: "get_credit_card_rates_time_series",
    description: "rejects a numeric issuerId",
    args: { issuerId: 5 },
  },
];

describe("MCP tool argument validation", () => {
  for (const testCase of validToolArgsCases) {
    const label = testCase.args
      ? `accepts valid arguments for ${testCase.tool} (${JSON.stringify(testCase.args)})`
      : `accepts valid arguments for ${testCase.tool} (no arguments)`;

    test(label, async () => {
      const spy = createSpyEnv();

      const response = await mcpRequest(spy.getEnv, {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: testCase.tool,
          ...(testCase.args ? { arguments: testCase.args } : {}),
        },
      });

      expect(response.status).toBe(200);
      const body = requireRecord(await jsonBody(response));
      // Schema-valid arguments must clear validation (no top-level
      // JSON-RPC error, i.e. no -32602/-32601) and reach the shared
      // lookup. The underlying REST call can still legitimately surface
      // its own not-found/error result as MCP content -- that is a
      // separate concern from argument validation.
      expect(body.error).toBeUndefined();
      expect(readRecord(body, "result")).toBeDefined();
      expect(spy.getCallCount()).toBeGreaterThan(0);
    });
  }

  for (const testCase of invalidToolArgsCases) {
    test(`${testCase.tool}: ${testCase.description}`, async () => {
      const spy = createSpyEnv();

      const response = await mcpRequest(spy.getEnv, {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: testCase.tool,
          arguments: testCase.args,
        },
      });

      expect(response.status).toBe(200);
      const body = requireRecord(await jsonBody(response));
      expect(body.result).toBeUndefined();
      const error = readRecord(body, "error");
      expect(error?.code).toBe(-32_602);
      expect(spy.getCallCount()).toBe(0);
    });
  }

  test("rejects an unknown tool name before touching the database", async () => {
    const spy = createSpyEnv();

    const response = await mcpRequest(spy.getEnv, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "does_not_exist", arguments: {} },
    });

    expect(response.status).toBe(200);
    const body = requireRecord(await jsonBody(response));
    const error = readRecord(body, "error");
    expect(error?.code).toBe(-32_601);
    expect(spy.getCallCount()).toBe(0);
  });
});

const MODERN_META = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": {
    name: "test-client",
    version: "1.0.0",
  },
  "io.modelcontextprotocol/clientCapabilities": {},
};

// A 2026-07-28 request: per-request _meta plus the mirrored headers.
function modernMcpRequest(
  getEnv: () => Environment,
  method: string,
  params: Record<string, unknown> = {},
  headerOverrides: Record<string, string | null> = {}
) {
  const defaults: Record<string, string | null> = {
    "content-type": "application/json",
    "mcp-protocol-version": "2026-07-28",
    "mcp-method": method,
    "mcp-name": typeof params.name === "string" ? params.name : null,
  };
  const headers = Object.fromEntries(
    Object.entries({ ...defaults, ...headerOverrides }).filter(
      (entry): entry is [string, string] => entry[1] !== null
    )
  );
  return requestWithEnv(getEnv, "/api/v1/mcp", "http://localhost", {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params: { ...params, _meta: MODERN_META },
    }),
  });
}

describe("MCP 2026-07-28 (stateless) requests", () => {
  test("server/discover lists versions, capabilities, and cache hints", async () => {
    const response = await modernMcpRequest(createEnv, "server/discover");

    expect(response.status).toBe(200);
    const body = requireRecord(await jsonBody(response));
    expect(body.result).toEqual({
      resultType: "complete",
      supportedVersions: [
        "2026-07-28",
        "2025-11-25",
        "2025-06-18",
        "2025-03-26",
        "2024-11-05",
      ],
      capabilities: { tools: { listChanged: false } },
      instructions: expect.stringContaining("Rates API"),
      ttlMs: 3_600_000,
      cacheScope: "public",
      _meta: {
        "io.modelcontextprotocol/serverInfo": expect.objectContaining({
          name: "ratesapi-mcp",
          version: expect.any(String),
        }),
      },
    });
  });

  test("tools/list returns the same tools with cache hints", async () => {
    const response = await modernMcpRequest(createEnv, "tools/list");

    expect(response.status).toBe(200);
    const result = readRecord(
      requireRecord(await jsonBody(response)),
      "result"
    );
    expect(result?.resultType).toBe("complete");
    expect(result?.ttlMs).toBe(3_600_000);
    expect(result?.cacheScope).toBe("public");
    expect(readArray(result, "tools")).toEqual(EXPECTED_MCP_TOOLS);
  });

  test("tools/call returns structured and text content", async () => {
    const response = await modernMcpRequest(createEnv, "tools/call", {
      name: "list_mortgage_rates",
      arguments: { termInMonths: "12" },
    });

    expect(response.status).toBe(200);
    const result = readRecord(
      requireRecord(await jsonBody(response)),
      "result"
    );
    expect(result?.resultType).toBe("complete");
    expect(result?.structuredContent).toMatchObject({ type: "MortgageRates" });
    const [text] = readArray(result, "content");
    expect(JSON.parse(String(readRecord(text, "self")?.text))).toEqual(
      result?.structuredContent
    );
  });

  test("reports invalid arguments as a tool error without touching the database", async () => {
    const spy = createSpyEnv();
    const response = await modernMcpRequest(spy.getEnv, "tools/call", {
      name: "list_mortgage_rates",
      arguments: { termInMonths: 12 },
    });

    expect(response.status).toBe(200);
    const result = readRecord(
      requireRecord(await jsonBody(response)),
      "result"
    );
    expect(result).toMatchObject({ resultType: "complete", isError: true });
    expect(spy.getCallCount()).toBe(0);
  });

  test("rejects an unknown tool with -32602", async () => {
    const response = await modernMcpRequest(createEnv, "tools/call", {
      name: "does_not_exist",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: -32_602, message: "Unknown tool: does_not_exist" },
    });
  });

  for (const method of ["ping", "resources/list"]) {
    test(`answers the unknown or removed method ${method} with 404 and -32601`, async () => {
      const response = await modernMcpRequest(createEnv, method);
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: -32_601 },
      });
    });
  }

  test("returns UnsupportedProtocolVersionError for an unknown version", async () => {
    const response = await requestWithEnv(
      createEnv,
      "/api/v1/mcp",
      "http://localhost",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "mcp-protocol-version": "2099-01-01",
          "mcp-method": "tools/list",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {
            _meta: {
              ...MODERN_META,
              "io.modelcontextprotocol/protocolVersion": "2099-01-01",
            },
          },
        }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: -32_022,
        data: {
          supported: expect.arrayContaining(["2026-07-28", "2025-11-25"]),
          requested: "2099-01-01",
        },
      },
    });
  });

  const headerCases: {
    description: string;
    overrides: Record<string, string | null>;
  }[] = [
    {
      description: "a missing Mcp-Method header",
      overrides: { "mcp-method": null },
    },
    {
      description: "a mismatched Mcp-Method header",
      overrides: { "mcp-method": "tools/list" },
    },
    {
      description: "a missing Mcp-Name header",
      overrides: { "mcp-name": null },
    },
    {
      description: "a mismatched Mcp-Name header",
      overrides: { "mcp-name": "list_car_loan_rates" },
    },
    {
      description: "a malformed Base64 Mcp-Name header",
      overrides: { "mcp-name": "=?base64?%%%?=" },
    },
    {
      description: "a mismatched MCP-Protocol-Version header",
      overrides: { "mcp-protocol-version": "2025-11-25" },
    },
    {
      description: "a missing MCP-Protocol-Version header",
      overrides: { "mcp-protocol-version": null },
    },
  ];

  for (const { description, overrides } of headerCases) {
    test(`rejects ${description} with 400 and -32020`, async () => {
      const spy = createSpyEnv();
      const response = await modernMcpRequest(
        spy.getEnv,
        "tools/call",
        { name: "list_mortgage_rates" },
        overrides
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: -32_020 },
      });
      expect(spy.getCallCount()).toBe(0);
    });
  }

  test("accepts a Base64-encoded Mcp-Name header", async () => {
    const response = await modernMcpRequest(
      createEnv,
      "tools/call",
      { name: "list_car_loan_rates" },
      { "mcp-name": `=?base64?${btoa("list_car_loan_rates")}?=` }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      result: { resultType: "complete" },
    });
  });

  test("rejects a request without the required client capabilities", async () => {
    const response = await requestWithEnv(
      createEnv,
      "/api/v1/mcp",
      "http://localhost",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "mcp-protocol-version": "2026-07-28",
          "mcp-method": "tools/list",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {
            _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" },
          },
        }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: -32_602 },
    });
  });
});

describe("MCP legacy (initialize-based) requests", () => {
  for (const version of [
    "2025-11-25",
    "2025-06-18",
    "2025-03-26",
    "2024-11-05",
  ]) {
    test(`echoes the supported legacy version ${version} from initialize`, async () => {
      const response = await mcpRequest(createEnv, {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: version, capabilities: {} },
      });
      await expect(response.json()).resolves.toMatchObject({
        result: {
          protocolVersion: version,
          capabilities: { tools: { listChanged: false } },
          instructions: expect.stringContaining("Rates API"),
        },
      });
    });
  }

  for (const version of ["2099-01-01", "2026-07-28", null]) {
    test(`answers initialize for ${String(version)} with the newest legacy version`, async () => {
      const response = await mcpRequest(createEnv, {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: version, capabilities: {} },
      });
      await expect(response.json()).resolves.toMatchObject({
        result: { protocolVersion: "2025-11-25" },
      });
    });
  }

  test("follows the 2025-11-25 tool error rules when that header is sent", async () => {
    const response = await requestWithEnv(
      createEnv,
      "/api/v1/mcp",
      "http://localhost",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "mcp-protocol-version": "2025-11-25",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "list_mortgage_rates",
            arguments: { termInMonths: 12 },
          },
        }),
      }
    );

    const body = requireRecord(await jsonBody(response));
    expect(body.error).toBeUndefined();
    expect(readRecord(body, "result")).toMatchObject({ isError: true });
    expect(readRecord(body, "result")?.resultType).toBeUndefined();
  });

  test("adds structuredContent only for 2025-06-18 and later", async () => {
    const newer = readRecord(
      requireRecord(
        await jsonBody(
          await callCarLoansTool({ "mcp-protocol-version": "2025-06-18" })
        )
      ),
      "result"
    );
    const older = readRecord(
      requireRecord(await jsonBody(await callCarLoansTool({}))),
      "result"
    );
    expect(newer?.structuredContent).toMatchObject({ type: "CarLoanRates" });
    expect(older?.structuredContent).toBeUndefined();
  });

  test("answers a batch, leaving out its notifications", async () => {
    const response = await mcpRequest(createEnv, [
      { jsonrpc: "2.0", id: 1, method: "ping" },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
    ]);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject([
      { id: 1, result: {} },
      { id: 2, result: { tools: expect.any(Array) } },
    ]);
  });

  test("accepts an all-notification batch with 202", async () => {
    const response = await mcpRequest(createEnv, [
      { jsonrpc: "2.0", method: "notifications/initialized" },
    ]);
    expect(response.status).toBe(202);
  });

  test("rejects an empty batch with a single Invalid Request error", async () => {
    const response = await mcpRequest(createEnv, []);
    await expect(response.json()).resolves.toMatchObject({
      id: null,
      error: { code: -32_600 },
    });
  });

  test("rejects a batch from a revision that removed batching", async () => {
    const response = await requestWithEnv(
      createEnv,
      "/api/v1/mcp",
      "http://localhost",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "mcp-protocol-version": "2025-06-18",
        },
        body: JSON.stringify([{ jsonrpc: "2.0", id: 1, method: "ping" }]),
      }
    );
    expect(response.status).toBe(400);
  });

  for (const method of ["GET", "DELETE"]) {
    test(`answers ${method} with 405 and Allow: POST`, async () => {
      const response = await request("/api/v1/mcp", { method });
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("POST");
    });
  }
});

// A legacy tools/call with no arguments, with extra request headers.
function callCarLoansTool(headers: Record<string, string>) {
  return requestWithEnv(createEnv, "/api/v1/mcp", "http://localhost", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "list_car_loan_rates" },
    }),
  });
}

function mcpRequest(
  getEnv: () => Environment,
  body: unknown,
  options: { raw?: string } = {}
) {
  return requestWithEnv(getEnv, "/api/v1/mcp", "http://localhost", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: options.raw ?? JSON.stringify(body),
  });
}

function createSpyEnv(): {
  getEnv: () => Environment;
  getCallCount: () => number;
} {
  const base = createEnv();
  let callCount = 0;
  const db: Environment["RATESAPI_DB"] = {
    prepare(sql: string) {
      callCount += 1;
      return base.RATESAPI_DB.prepare(sql);
    },
  };

  return {
    getEnv: () => ({ ...base, RATESAPI_DB: db }),
    getCallCount: () => callCount,
  };
}

function request(path: string, init: RequestInit = {}) {
  return requestWithEnv(createEnv, path, "http://localhost", init);
}

function requestWithEnv(
  getEnv: () => Environment,
  path: string,
  origin: string,
  init: RequestInit = {}
) {
  const app = createApp(getEnv);
  return app.handle(new Request(new URL(path, origin).toString(), init));
}

function createEnv(): Environment {
  return {
    ENVIRONMENT: "test",
    RATESAPI_DB: createD1Mock({
      latest: {
        "mortgage-rates": mortgageRates,
        "personal-loan-rates": personalLoanRates,
        "car-loan-rates": carLoanRates,
        "credit-card-rates": creditCardRates,
      },
      historical: {
        "mortgage-rates": {
          "2026-04-30": mortgageRates,
        },
      },
    }),
  };
}

function createProductionEnv(): Environment {
  const env = createEnv();

  return {
    ENVIRONMENT: "production",
    RATESAPI_DB: env.RATESAPI_DB,
  };
}

function createD1Mock(data: {
  latest: Partial<Record<DataType, SupportedModels>>;
  historical: Partial<Record<DataType, Record<string, SupportedModels>>>;
}): Environment["RATESAPI_DB"] {
  return {
    prepare(sql: string) {
      return createStatement(sql, [], data);
    },
  };
}

function createStatement(
  sql: string,
  boundValues: unknown[],
  data: {
    latest: Partial<Record<DataType, SupportedModels>>;
    historical: Partial<Record<DataType, Record<string, SupportedModels>>>;
  }
) {
  return {
    bind(...values: unknown[]) {
      return createStatement(sql, values, data);
    },
    async first() {
      return selectFirst(sql, boundValues, data);
    },
    async all() {
      return { results: selectAll(sql, boundValues, data) };
    },
    async run() {
      return {};
    },
  };
}

function selectFirst(
  sql: string,
  boundValues: unknown[],
  data: {
    latest: Partial<Record<DataType, SupportedModels>>;
    historical: Partial<Record<DataType, Record<string, SupportedModels>>>;
  }
): Record<string, unknown> | null {
  if (sql.includes("FROM latest_data")) {
    const dataType = readDataType(boundValues[0]);
    if (!dataType) {
      return null;
    }

    const latestData = data.latest[dataType];
    return latestData ? { data: toSavableJson(latestData) } : null;
  }

  if (sql.includes("FROM historical_data")) {
    const dataType = readDataType(boundValues[0]);
    const date = readString(boundValues[1]);
    if (!dataType || !date) {
      return null;
    }

    const historicalData = data.historical[dataType]?.[date];
    return historicalData ? { data: toSavableJson(historicalData) } : null;
  }

  return null;
}

function selectAll(
  sql: string,
  boundValues: unknown[],
  data: {
    latest: Partial<Record<DataType, SupportedModels>>;
    historical: Partial<Record<DataType, Record<string, SupportedModels>>>;
  }
): Record<string, unknown>[] {
  if (sql.includes("FROM latest_data")) {
    return Object.keys(data.latest).map((dataType) => ({
      data_type: dataType,
      last_updated: "2026-04-30 00:00:00",
    }));
  }

  if (sql.includes("SELECT date FROM historical_data")) {
    const dataType = readDataType(boundValues[0]);
    if (!dataType) {
      return [];
    }

    return Object.keys(data.historical[dataType] ?? {}).map((date) => ({
      date,
    }));
  }

  if (sql.includes("SELECT date, data FROM historical_data")) {
    const dataType = readDataType(boundValues[0]);
    const startDate = readString(boundValues[1]);
    const endDate = readString(boundValues[2]);
    if (!dataType || !startDate || !endDate) {
      return [];
    }

    return Object.entries(data.historical[dataType] ?? {})
      .filter(([date]) => date >= startDate && date <= endDate)
      .map(([date, snapshot]) => ({
        date,
        data: toSavableJson(snapshot),
      }));
  }

  return [];
}

async function jsonBody(response: Response): Promise<unknown> {
  const body: unknown = await response.json();
  return body;
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error("Expected JSON object");
  }

  return value;
}

function readRecord(
  value: unknown,
  key: string
): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (key === "self") {
    return value;
  }

  const field = value[key];
  return isRecord(field) ? field : undefined;
}

function readArray(value: unknown, key: string): unknown[] {
  if (!isRecord(value)) {
    return [];
  }

  const field = value[key];
  return Array.isArray(field) ? field : [];
}

function findOperationDocumentationProblems(
  operation: Record<string, unknown>,
  tagNames: unknown[]
): string[] {
  const id = String(operation.operationId);
  const parameters = readArray(operation, "parameters").map((parameter) =>
    readRecord(parameter, "self")
  );
  const responses = Object.entries(readRecord(operation, "responses") ?? {});

  return [
    typeof operation.summary === "string" ? [] : [`${id} has no summary`],
    typeof operation.description === "string"
      ? []
      : [`${id} has no description`],
    readArray(operation, "tags")
      .filter((tag) => !tagNames.includes(tag))
      .map((tag) => `${id} uses undeclared tag ${String(tag)}`),
    parameters
      .filter((parameter) => typeof parameter?.description !== "string")
      .map(
        (parameter) =>
          `${id} parameter ${String(parameter?.name)} has no description`
      ),
    responses
      .filter(([, response]) => !hasResponseDescription(response))
      .map(([status]) => `${id} response ${status} has no description`),
  ].flat();
}

function hasResponseDescription(response: unknown): boolean {
  const description = readRecord(response, "self")?.description;

  return (
    typeof description === "string" &&
    !description.startsWith("Response for status")
  );
}

function readDataType(value: unknown): DataType | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return isDataType(value) ? value : undefined;
}

function isDataType(value: string): value is DataType {
  return [
    "mortgage-rates",
    "car-loan-rates",
    "credit-card-rates",
    "personal-loan-rates",
  ].includes(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
