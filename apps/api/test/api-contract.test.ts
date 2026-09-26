import { describe, expect, test } from "bun:test";

import { createApp } from "../src/app";
import { toSavableJson } from "../src/lib/data-loader";
import type { DataType, SupportedModels } from "../src/lib/data-loader";
import type { Environment } from "../src/lib/environment";
import { scalarBundle } from "../src/lib/openapi-page";
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
      lastChecked: "2026-04-30 01:00:00",
      stale: true,
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

  test("exposes OpenAPI UI and JSON, including the MCP endpoint", async () => {
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
    // Only POST is documented; GET and DELETE exist to answer 405.
    const mcpPath = readRecord(paths, "/api/v1/mcp");
    expect(Object.keys(mcpPath ?? {})).toEqual(["post"]);
    expect(readRecord(mcpPath, "post")?.operationId).toBe("sendMcpMessage");
    const schemas = readRecord(readRecord(spec, "components"), "schemas");
    expect(readRecord(schemas, "McpMessage")).toBeDefined();
    expect(readRecord(schemas, "McpResponse")).toBeDefined();
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
    expect(operations.length).toBe(14);
    expect(problems).toEqual([]);
  });

  test("uses the production server as the OpenAPI default in production", async () => {
    const specResponse = await requestWithEnv(
      createProductionEnv,
      "/openapi/json",
      "https://www.ratesapi.nz"
    );
    expect(specResponse.status).toBe(200);

    const spec = requireRecord(await jsonBody(specResponse));
    const servers = readArray(spec, "servers");
    const defaultServer = readRecord(servers[0], "self");

    expect(defaultServer?.url).toBe("https://www.ratesapi.nz");
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

  test("serves MCP with a trailing slash", async () => {
    const response = await request("/api/v1/mcp/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
    });

    expect(response.status).toBe(200);
    expect(await jsonBody(response)).toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: {},
    });
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

async function requestHealth(lastChecked: MockData["lastChecked"]) {
  const response = await requestWithEnv(
    () => createEnv(lastChecked),
    "/api/v1/health",
    "http://localhost"
  );

  expect(response.status).toBe(200);
  return parseSchema(HealthResponse, await jsonBody(response));
}

describe("health data freshness", () => {
  const hour = 60 * 60 * 1000;

  test("keeps lastUpdated and adds lastChecked and stale after the existing fields", async () => {
    const lastChecked = toD1Timestamp(new Date(Date.now() - hour));
    const body = await requestHealth(lastChecked);

    expect(body.status).toBe("ok");
    expect(body.dataSets).toHaveLength(4);
    for (const dataSet of body.dataSets) {
      expect(Object.keys(dataSet)).toEqual([
        "dataType",
        "lastUpdated",
        "lastChecked",
        "stale",
      ]);
      expect(dataSet.lastUpdated).toBe("2026-04-30 00:00:00");
      expect(dataSet.lastChecked).toBe(lastChecked);
      expect(dataSet.stale).toBe(false);
    }
  });

  test("marks a dataset stale after 3 hours without a check, and keeps status ok", async () => {
    const body = await requestHealth(
      toD1Timestamp(new Date(Date.now() - 4 * hour))
    );

    expect(body.status).toBe("ok");
    expect(body.dataSets.every((dataSet) => dataSet.stale === true)).toBe(true);
  });

  test("does not mark a dataset stale just inside 3 hours", async () => {
    const body = await requestHealth(
      toD1Timestamp(new Date(Date.now() - 3 * hour + 60_000))
    );

    expect(body.dataSets.every((dataSet) => dataSet.stale === false)).toBe(
      true
    );
  });

  test("returns null lastChecked and stale when a dataset has no check yet", async () => {
    const body = await requestHealth(null);

    expect(body.status).toBe("ok");
    expect(body.dataSets).toContainEqual({
      dataType: "mortgage-rates",
      lastUpdated: "2026-04-30 00:00:00",
      lastChecked: null,
      stale: null,
    });
  });

  test("falls back to the old query when the database has no last_checked column", async () => {
    const body = await requestHealth("missing-column");

    expect(body.status).toBe("ok");
    expect(body.dataSets).toHaveLength(4);
    expect(body.dataSets).toContainEqual({
      dataType: "mortgage-rates",
      lastUpdated: "2026-04-30 00:00:00",
      lastChecked: null,
      stale: null,
    });
  });

  test("still returns the error response when the database cannot be read", async () => {
    const failingDb: Environment["RATESAPI_DB"] = {
      prepare() {
        throw new Error("D1 is not available");
      },
    };
    const response = await requestWithEnv(
      () => ({ ENVIRONMENT: "test", RATESAPI_DB: failingDb }),
      "/api/v1/health",
      "http://localhost"
    );

    expect(response.status).toBe(500);
    const body = requireRecord(await jsonBody(response));
    expect(Object.keys(body)).toEqual(["status", "message", "timestamp"]);
    expect(body.status).toBe("error");
    expect(body.message).toBe("Unable to read data freshness");
  });
});

function expectSecurityHeaders(response: Response) {
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("referrer-policy")).toBe(
    "strict-origin-when-cross-origin"
  );
  // Only headers that JSON clients ignore. A frame policy or HSTS could
  // change how existing clients use the API.
  expect(response.headers.get("x-frame-options")).toBeNull();
  expect(response.headers.get("content-security-policy")).toBeNull();
  expect(response.headers.get("strict-transport-security")).toBeNull();
}

describe("response headers", () => {
  const cacheControl = "public, max-age=300";

  for (const path of [
    "/api/v1/mortgage-rates",
    "/api/v1/mortgage-rates/",
    "/api/v1/mortgage-rates?termInMonths=12",
    "/api/v1/mortgage-rates/institution:anz",
    "/api/v1/mortgage-rates/time-series",
    "/api/v1/mortgage-rates/time-series?date=2026-04-30",
    "/api/v1/personal-loan-rates",
    "/api/v1/personal-loan-rates/institution:asb",
    "/api/v1/car-loan-rates",
    "/api/v1/car-loan-rates/institution:asb",
    "/api/v1/credit-card-rates",
    "/api/v1/credit-card-rates/issuer:amex",
    "/openapi/json",
  ]) {
    test(`caches the successful GET ${path} and asks crawlers not to index it`, async () => {
      const response = await request(path);

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe(cacheControl);
      expect(response.headers.get("x-robots-tag")).toBe("noindex");
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expectSecurityHeaders(response);
    });
  }

  test("does not cache health, so monitors get a fresh answer", async () => {
    const response = await request("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBeNull();
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expectSecurityHeaders(response);
  });

  for (const [description, path, status] of [
    ["an unknown institution", "/api/v1/mortgage-rates/institution:nope", 404],
    [
      "a missing snapshot",
      "/api/v1/mortgage-rates/time-series?date=2026-01-01",
      404,
    ],
    [
      "an impossible date",
      "/api/v1/mortgage-rates/time-series?date=2026-02-30",
      400,
    ],
    [
      "a query that fails validation",
      "/api/v1/mortgage-rates?termInMonths=abc",
      400,
    ],
    ["an unknown API path", "/api/v1/unknown", 404],
  ] as const) {
    test(`does not cache the error for ${description}`, async () => {
      const response = await request(path);

      expect(response.status).toBe(status);
      expect(response.headers.get("cache-control")).toBeNull();
      expect(response.headers.get("x-robots-tag")).toBe("noindex");
      expectSecurityHeaders(response);
    });
  }

  test("keeps the validation error body unchanged", async () => {
    const response = await request("/api/v1/mortgage-rates?termInMonths=abc");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 400,
      message: "Invalid request parameters",
    });
  });

  test("adds only the security headers to MCP POST responses", async () => {
    const responses = await Promise.all(
      [
        { jsonrpc: "2.0", id: 1, method: "tools/list" },
        { jsonrpc: "2.0", method: "notifications/initialized" },
      ].map((body) =>
        request("/api/v1/mcp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        })
      )
    );

    expect(responses.map((response) => response.status)).toEqual([200, 202]);
    for (const response of responses) {
      expect(response.headers.get("cache-control")).toBeNull();
      expect(response.headers.get("x-robots-tag")).toBeNull();
      expectSecurityHeaders(response);
    }
  });

  test("adds the security headers to CORS preflight and unknown paths", async () => {
    const preflight = await request("/api/v1/mortgage-rates", {
      method: "OPTIONS",
      headers: {
        origin: "https://example.com",
        "access-control-request-method": "GET",
      },
    });
    const notFound = await request("/unknown");

    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("cache-control")).toBeNull();
    expectSecurityHeaders(preflight);
    expect(notFound.status).toBe(404);
    expect(notFound.headers.get("x-robots-tag")).toBeNull();
    expectSecurityHeaders(notFound);
  });

  test("lets crawlers index the /openapi page", async () => {
    const response = await request("/openapi");

    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toBeNull();
    expect(response.headers.get("cache-control")).toBeNull();
    expectSecurityHeaders(response);
  });
});

async function openApiHtml(origin = "http://localhost") {
  const response = await requestWithEnv(createEnv, "/openapi", origin);

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
  return response.text();
}

function metaContent(html: string, attribute: string, name: string) {
  return [
    ...html.matchAll(
      new RegExp(`<meta ${attribute}="${name}" content="([^"]*)"`, "gu")
    ),
  ].map((match) => match[1]);
}

describe("OpenAPI page", () => {
  test("sets the language, title, and a short plain description", async () => {
    const html = await openApiHtml();
    const [description] = metaContent(html, "name", "description");

    expect(html).toContain('<html lang="en">');
    expect(html.match(/<title>/gu)).toHaveLength(1);
    expect(html).toContain(
      "<title>NZ Interest Rates API Reference (OpenAPI) | Rates API</title>"
    );
    expect(metaContent(html, "name", "description")).toHaveLength(1);
    expect(description?.length).toBeGreaterThan(50);
    expect(description?.length).toBeLessThanOrEqual(160);
    expect(description).not.toContain("\n");
    expect(description).not.toMatch(/[[\]()`*]/u);
  });

  test("has a canonical URL, Open Graph properties, and icons", async () => {
    const html = await openApiHtml();

    expect(html).toContain(
      '<link rel="canonical" href="https://www.ratesapi.nz/openapi" />'
    );
    expect(html).not.toContain('name="og:');
    expect(metaContent(html, "property", "og:title")).toEqual([
      "NZ Interest Rates API Reference (OpenAPI) | Rates API",
    ]);
    expect(metaContent(html, "property", "og:description")).toEqual(
      metaContent(html, "name", "description")
    );
    expect(metaContent(html, "property", "og:url")).toEqual([
      "https://www.ratesapi.nz/openapi",
    ]);
    expect(metaContent(html, "property", "og:type")).toEqual(["website"]);
    expect(metaContent(html, "property", "og:site_name")).toEqual([
      "Rates API",
    ]);
    expect(metaContent(html, "property", "og:image")).toEqual([
      "https://www.ratesapi.nz/images/og-card.png",
    ]);
    expect(metaContent(html, "property", "og:image:width")).toEqual(["1200"]);
    expect(metaContent(html, "property", "og:image:height")).toEqual(["630"]);
    expect(metaContent(html, "property", "og:image:alt")).toEqual([
      "Rates API: free New Zealand interest rates API",
    ]);
    expect(metaContent(html, "name", "twitter:card")).toEqual([
      "summary_large_image",
    ]);
    expect(metaContent(html, "name", "theme-color")).toEqual(["#1a2035"]);
    expect(html).toContain(
      '<link rel="icon" href="/favicon.ico" sizes="48x48" />'
    );
    expect(html).toContain(
      'href="/ratesapi-terminal-light.svg" type="image/svg+xml" media="(prefers-color-scheme: light)"'
    );
    expect(html).toContain(
      'href="/ratesapi-terminal-dark.svg" type="image/svg+xml" media="(prefers-color-scheme: dark)"'
    );
    expect(html.indexOf('<meta charset="utf-8" />')).toBeLessThan(
      html.indexOf("<title>")
    );
  });

  test("gives readers without JavaScript a heading, the endpoints, and links", async () => {
    const html = await openApiHtml();
    const noscript = html.match(/<noscript>(?<content>[\s\S]*)<\/noscript>/u)
      ?.groups?.content;

    expect(noscript).toBeDefined();
    expect(noscript).toContain(
      "<h1>NZ Interest Rates API Reference (OpenAPI)</h1>"
    );
    for (const endpoint of [
      "GET /api/v1/mortgage-rates",
      "GET /api/v1/personal-loan-rates",
      "GET /api/v1/car-loan-rates",
      "GET /api/v1/credit-card-rates",
      "GET /api/v1/mortgage-rates/time-series",
      "GET /api/v1/health",
      "POST /api/v1/mcp",
    ]) {
      expect(noscript).toContain(`<code>${endpoint}</code>`);
    }
    for (const href of [
      "https://www.ratesapi.nz/docs/api-reference/quickstart",
      "https://www.ratesapi.nz/docs/api-reference",
      "/openapi/json",
    ]) {
      expect(noscript).toContain(`<a href="${href}">`);
    }
  });

  test("loads the pinned Scalar bundle with defer and Subresource Integrity", async () => {
    const html = await openApiHtml();
    const bundleUrl = `https://cdn.jsdelivr.net/npm/@scalar/api-reference@${scalarBundle.version}/dist/browser/standalone.js`;

    expect(scalarBundle.version).toMatch(/^\d+\.\d+\.\d+$/u);
    expect(scalarBundle.integrity).toMatch(/^sha384-[A-Za-z0-9+/]{64}$/u);
    expect(html).not.toContain("@latest");
    expect(html).toContain(
      `<script src="${bundleUrl}" integrity="${scalarBundle.integrity}" crossorigin defer></script>`
    );
    expect(html.match(/<script src=/gu)).toHaveLength(1);
  });

  test("keeps the Scalar configuration and the Elysia theme", async () => {
    const html = await openApiHtml();
    const configuration = html.match(/data-configuration='(?<json>[^']*)'/u)
      ?.groups?.json;

    expect(JSON.parse(configuration ?? "{}")).toMatchObject({
      url: "openapi/json",
      _integration: "elysiajs",
    });
    expect(html).toContain("--scalar-color-accent");
    expect(html).toContain(".section-flare");
  });

  test("builds the same page for every host", async () => {
    expect(await openApiHtml("https://www.ratesapi.nz")).toBe(
      await openApiHtml("http://localhost")
    );
  });

  test("keeps the page out of the OpenAPI document, which the app still serves", async () => {
    const response = await request("/openapi/json");
    const spec = requireRecord(await jsonBody(response));

    expect(response.headers.get("content-type")).toBe(
      "application/json;charset=utf-8"
    );
    expect(Object.keys(spec)).toEqual([
      "openapi",
      "info",
      "externalDocs",
      "tags",
      "security",
      "servers",
      "paths",
      "components",
    ]);
    expect(Object.keys(readRecord(spec, "paths") ?? {}).toSorted()).toEqual([
      "/api/v1/car-loan-rates",
      "/api/v1/car-loan-rates/time-series",
      "/api/v1/car-loan-rates/{institutionId}",
      "/api/v1/credit-card-rates",
      "/api/v1/credit-card-rates/time-series",
      "/api/v1/credit-card-rates/{issuerId}",
      "/api/v1/health",
      "/api/v1/mcp",
      "/api/v1/mortgage-rates",
      "/api/v1/mortgage-rates/time-series",
      "/api/v1/mortgage-rates/{institutionId}",
      "/api/v1/personal-loan-rates",
      "/api/v1/personal-loan-rates/time-series",
      "/api/v1/personal-loan-rates/{institutionId}",
    ]);
  });
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

function createEnv(
  lastChecked: MockData["lastChecked"] = "2026-04-30 01:00:00"
): Environment {
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
      lastChecked,
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

interface MockData {
  latest: Partial<Record<DataType, SupportedModels>>;
  historical: Partial<Record<DataType, Record<string, SupportedModels>>>;
  // The last_checked value of every latest_data row. "missing-column" acts
  // like a database without the migration: a query of the column fails.
  lastChecked?: string | null | "missing-column";
}

function createD1Mock(data: MockData): Environment["RATESAPI_DB"] {
  return {
    prepare(sql: string) {
      return createStatement(sql, [], data);
    },
  };
}

function createStatement(sql: string, boundValues: unknown[], data: MockData) {
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
  data: MockData
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
  data: MockData
): Record<string, unknown>[] {
  if (sql.includes("FROM latest_data")) {
    if (sql.includes("last_checked")) {
      if (data.lastChecked === "missing-column") {
        throw new Error("D1_ERROR: no such column: last_checked: SQLITE_ERROR");
      }

      return Object.keys(data.latest).map((dataType) => ({
        data_type: dataType,
        last_updated: "2026-04-30 00:00:00",
        last_checked: data.lastChecked ?? null,
      }));
    }

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

function toD1Timestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
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
