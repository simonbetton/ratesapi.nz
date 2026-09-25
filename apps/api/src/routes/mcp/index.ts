// oxlint-disable max-classes-per-file -- small error types private to this route
import { Type } from "@sinclair/typebox";
import type { TObject } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { Elysia } from "elysia";

import type { ApiResult } from "../../lib/api-result";
import type { Environment } from "../../lib/environment";
import type { GetEnv } from "../../lib/routing";
import {
  getCarLoanRatesByInstitution,
  getCarLoanRatesTimeSeries,
  listCarLoanRates,
} from "../car-loan-rates";
import {
  getCreditCardRatesByIssuer,
  getCreditCardRatesTimeSeries,
  listCreditCardRates,
} from "../credit-card-rates";
import {
  getMortgageRatesByInstitution,
  getMortgageRatesTimeSeries,
  listMortgageRates,
} from "../mortgage-rates";
import {
  getPersonalLoanRatesByInstitution,
  getPersonalLoanRatesTimeSeries,
  listPersonalLoanRates,
} from "../personal-loan-rates";

type JsonRpcId = string | number | null;

interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: JsonRpcError;
}

interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: TObject;
}

class JsonRpcResponseError extends Error {
  code: number;
  data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = "JsonRpcResponseError";
    this.code = code;
    this.data = data;
  }
}

class McpToolError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "McpToolError";
    this.status = status;
    this.body = body;
  }
}

const MCP_PROTOCOL_VERSION = "2024-11-05";

const MCP_SERVER_INFO = {
  name: "ratesapi-mcp",
  version: "1.0.0",
};

// Each tool's discovery schema (advertised via tools/list) and its runtime
// argument validation (enforced in handleToolCall) are derived from this one
// TypeBox definition per tool, so the two can never drift apart.
function optionalStringArg(description: string, examples: string[]) {
  return Type.Optional(Type.String({ description, examples }));
}

function requiredStringArg(description: string, examples: string[]) {
  return Type.String({ description, examples });
}

const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "list_mortgage_rates",
    description: "List latest mortgage rates for all institutions.",
    inputSchema: Type.Object(
      {
        termInMonths: optionalStringArg(
          "Optional mortgage term in months to filter by.",
          ["6", "12", "24", "36"]
        ),
      },
      { additionalProperties: false }
    ),
  },
  {
    name: "get_mortgage_rates_by_institution",
    description: "Get latest mortgage rates for a specific institution.",
    inputSchema: Type.Object(
      {
        institutionId: requiredStringArg("Institution ID to filter by.", [
          "institution:anz",
        ]),
        termInMonths: optionalStringArg(
          "Optional mortgage term in months to filter by.",
          ["6", "12", "24", "36"]
        ),
      },
      { additionalProperties: false }
    ),
  },
  {
    name: "get_mortgage_rates_time_series",
    description: "Get mortgage rates time series for a date or range.",
    inputSchema: Type.Object(
      {
        date: optionalStringArg(
          "Date in YYYY-MM-DD format for historical data.",
          ["2025-03-01"]
        ),
        startDate: optionalStringArg(
          "Start date in YYYY-MM-DD format for time series.",
          ["2025-01-01"]
        ),
        endDate: optionalStringArg(
          "End date in YYYY-MM-DD format for time series.",
          ["2025-03-01"]
        ),
        institutionId: optionalStringArg(
          "Optional institution ID to filter time series data.",
          ["institution:anz"]
        ),
        termInMonths: optionalStringArg(
          "Optional mortgage term in months to filter by.",
          ["6", "12", "24", "36"]
        ),
      },
      { additionalProperties: false }
    ),
  },
  {
    name: "list_personal_loan_rates",
    description: "List latest personal loan rates for all institutions.",
    inputSchema: Type.Object({}, { additionalProperties: false }),
  },
  {
    name: "get_personal_loan_rates_by_institution",
    description: "Get latest personal loan rates for a specific institution.",
    inputSchema: Type.Object(
      {
        institutionId: requiredStringArg("Institution ID to filter by.", [
          "institution:anz",
        ]),
      },
      { additionalProperties: false }
    ),
  },
  {
    name: "get_personal_loan_rates_time_series",
    description: "Get personal loan rates time series for a date or range.",
    inputSchema: Type.Object(
      {
        date: optionalStringArg(
          "Date in YYYY-MM-DD format for historical data.",
          ["2025-03-01"]
        ),
        startDate: optionalStringArg(
          "Start date in YYYY-MM-DD format for time series.",
          ["2025-01-01"]
        ),
        endDate: optionalStringArg(
          "End date in YYYY-MM-DD format for time series.",
          ["2025-03-01"]
        ),
        institutionId: optionalStringArg(
          "Optional institution ID to filter time series data.",
          ["institution:anz"]
        ),
      },
      { additionalProperties: false }
    ),
  },
  {
    name: "list_car_loan_rates",
    description: "List latest car loan rates for all institutions.",
    inputSchema: Type.Object({}, { additionalProperties: false }),
  },
  {
    name: "get_car_loan_rates_by_institution",
    description: "Get latest car loan rates for a specific institution.",
    inputSchema: Type.Object(
      {
        institutionId: requiredStringArg("Institution ID to filter by.", [
          "institution:anz",
        ]),
      },
      { additionalProperties: false }
    ),
  },
  {
    name: "get_car_loan_rates_time_series",
    description: "Get car loan rates time series for a date or range.",
    inputSchema: Type.Object(
      {
        date: optionalStringArg(
          "Date in YYYY-MM-DD format for historical data.",
          ["2025-03-01"]
        ),
        startDate: optionalStringArg(
          "Start date in YYYY-MM-DD format for time series.",
          ["2025-01-01"]
        ),
        endDate: optionalStringArg(
          "End date in YYYY-MM-DD format for time series.",
          ["2025-03-01"]
        ),
        institutionId: optionalStringArg(
          "Optional institution ID to filter time series data.",
          ["institution:anz"]
        ),
      },
      { additionalProperties: false }
    ),
  },
  {
    name: "list_credit_card_rates",
    description: "List latest credit card rates for all issuers.",
    inputSchema: Type.Object({}, { additionalProperties: false }),
  },
  {
    name: "get_credit_card_rates_by_issuer",
    description: "Get latest credit card rates for a specific issuer.",
    inputSchema: Type.Object(
      {
        issuerId: requiredStringArg("Issuer ID to filter by.", ["issuer:anz"]),
      },
      { additionalProperties: false }
    ),
  },
  {
    name: "get_credit_card_rates_time_series",
    description: "Get credit card rates time series for a date or range.",
    inputSchema: Type.Object(
      {
        date: optionalStringArg(
          "Date in YYYY-MM-DD format for historical data.",
          ["2025-03-01"]
        ),
        startDate: optionalStringArg(
          "Start date in YYYY-MM-DD format for time series.",
          ["2025-01-01"]
        ),
        endDate: optionalStringArg(
          "End date in YYYY-MM-DD format for time series.",
          ["2025-03-01"]
        ),
        issuerId: optionalStringArg(
          "Optional issuer ID to filter time series data.",
          ["issuer:anz"]
        ),
      },
      { additionalProperties: false }
    ),
  },
];

const MCP_TOOLS_BY_NAME = new Map(MCP_TOOLS.map((tool) => [tool.name, tool]));

export function createMcpRoutes(getEnv: GetEnv) {
  return new Elysia({ prefix: "/mcp" }).post(
    "/",
    async ({ request, status }) => {
      let body: unknown;

      try {
        body = await request.json();
      } catch (error) {
        const response: JsonRpcResponse = {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32_700,
            message: "Parse error",
            data: error instanceof Error ? error.message : undefined,
          },
        };

        return status(400, response);
      }

      // Parsing the envelope (jsonrpc/method/id shape) is tracked separately
      // from dispatching the method: an invalid envelope must never be
      // treated as a notification, and recovering an id for its error
      // response must never itself throw.
      let envelope: ReturnType<typeof parseJsonRpcRequest>;

      try {
        envelope = parseJsonRpcRequest(body);
      } catch (error) {
        const response: JsonRpcResponse = {
          jsonrpc: "2.0",
          id: recoverRequestId(body),
          error: toJsonRpcError(error),
        };

        return response;
      }

      const { id, hasId, method, params } = envelope;

      try {
        const result = await handleMethod(method, params, getEnv);

        if (!hasId) {
          return status(204);
        }

        const response: JsonRpcResponse = {
          jsonrpc: "2.0",
          id,
          result,
        };

        return response;
      } catch (error) {
        // The envelope was valid, so a notification (no id) stays a
        // notification even when the method or tool call fails.
        if (!hasId) {
          return status(204);
        }

        const response: JsonRpcResponse = {
          jsonrpc: "2.0",
          id,
          error: toJsonRpcError(error),
        };

        return response;
      }
    },
    {
      detail: {
        hide: true,
      },
    }
  );
}

function parseJsonRpcRequest(body: unknown) {
  if (!isRecord(body)) {
    throw new JsonRpcResponseError(-32_600, "Invalid Request");
  }

  if (body.jsonrpc !== "2.0") {
    throw new JsonRpcResponseError(-32_600, "Invalid Request");
  }

  if (typeof body.method !== "string" || body.method.length === 0) {
    throw new JsonRpcResponseError(-32_600, "Invalid Request");
  }

  const { id, hasId } = parseRequestId(body);

  return {
    id,
    hasId,
    method: body.method,
    params: body.params,
  };
}

function parseRequestId(body: unknown) {
  if (!isRecord(body)) {
    return { id: null, hasId: false };
  }

  const hasId = Object.hasOwn(body, "id");
  const id = hasId ? (body.id ?? null) : null;

  if (id === null || typeof id === "string" || typeof id === "number") {
    return { id, hasId };
  }

  if (hasId) {
    throw new JsonRpcResponseError(-32_600, "Invalid Request");
  }

  return { id: null, hasId };
}

// Best-effort id recovery for an envelope that failed to parse. Unlike
// parseRequestId, this never throws: an id of the wrong type (or a body
// that isn't even an object) simply recovers as null so the error handler
// can always produce a response.
function recoverRequestId(body: unknown): JsonRpcId {
  if (!isRecord(body)) {
    return null;
  }

  const { id } = body;

  return typeof id === "string" || typeof id === "number" ? id : null;
}

function toJsonRpcError(error: unknown): JsonRpcError {
  if (error instanceof JsonRpcResponseError) {
    return {
      code: error.code,
      message: error.message,
      data: error.data,
    };
  }

  return {
    code: -32_603,
    message: "Internal error",
    data: error instanceof Error ? error.message : undefined,
  };
}

async function handleMethod(method: string, params: unknown, getEnv: GetEnv) {
  switch (method) {
    case "initialize": {
      return {
        protocolVersion: MCP_PROTOCOL_VERSION,
        serverInfo: MCP_SERVER_INFO,
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
      };
    }
    case "ping": {
      return {};
    }
    case "tools/list": {
      return {
        tools: MCP_TOOLS,
      };
    }
    case "tools/call": {
      return await handleToolCall(params, getEnv);
    }
    default: {
      throw new JsonRpcResponseError(-32_601, `Method not found: ${method}`);
    }
  }
}

async function handleToolCall(params: unknown, getEnv: GetEnv) {
  if (!isRecord(params)) {
    throw new JsonRpcResponseError(-32_602, "Invalid params");
  }

  const { name } = params;
  const args = params.arguments;

  if (typeof name !== "string" || name.length === 0) {
    throw new JsonRpcResponseError(
      -32_602,
      "Invalid params: missing tool name"
    );
  }

  const tool = MCP_TOOLS_BY_NAME.get(name);

  if (!tool) {
    throw new JsonRpcResponseError(-32_601, `Tool not found: ${name}`);
  }

  // Optional arguments default to an empty object; everything else is
  // checked against the tool's advertised inputSchema (the same TypeBox
  // definition used to build its tools/list entry) before any database
  // work happens. Value.Check/Value.Errors are used instead of
  // Value.Parse/Clean/Convert so nothing is coerced or silently stripped:
  // wrong types, unknown properties, arrays, and missing required fields
  // are all rejected as-is.
  const toolArguments = args === undefined ? {} : args;

  if (!Value.Check(tool.inputSchema, toolArguments)) {
    const [firstError] = Value.Errors(tool.inputSchema, toolArguments);
    const detail = firstError
      ? `${firstError.path || "/"} ${firstError.message}`
      : "arguments do not match the tool's input schema";

    throw new JsonRpcResponseError(-32_602, `Invalid params: ${detail}`);
  }

  try {
    const result = await callTool(
      name,
      toolArguments as Record<string, unknown>,
      getEnv()
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    if (error instanceof McpToolError) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: error.message,
                status: error.status,
                body: error.body,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    throw error;
  }
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  env: Environment
) {
  switch (name) {
    case "list_mortgage_rates": {
      return unwrapApiResult(
        await listMortgageRates(env, {
          termInMonths: toOptionalString(args.termInMonths),
        })
      );
    }
    case "get_mortgage_rates_by_institution": {
      return unwrapApiResult(
        await getMortgageRatesByInstitution(
          env,
          {
            institutionId: toRequiredString(
              args.institutionId,
              "institutionId"
            ),
          },
          {
            termInMonths: toOptionalString(args.termInMonths),
          }
        )
      );
    }
    case "get_mortgage_rates_time_series": {
      return unwrapApiResult(
        await getMortgageRatesTimeSeries(env, {
          date: toOptionalString(args.date),
          startDate: toOptionalString(args.startDate),
          endDate: toOptionalString(args.endDate),
          institutionId: toOptionalString(args.institutionId),
          termInMonths: toOptionalString(args.termInMonths),
        })
      );
    }
    case "list_personal_loan_rates": {
      return unwrapApiResult(await listPersonalLoanRates(env));
    }
    case "get_personal_loan_rates_by_institution": {
      return unwrapApiResult(
        await getPersonalLoanRatesByInstitution(env, {
          institutionId: toRequiredString(args.institutionId, "institutionId"),
        })
      );
    }
    case "get_personal_loan_rates_time_series": {
      return unwrapApiResult(
        await getPersonalLoanRatesTimeSeries(env, {
          date: toOptionalString(args.date),
          startDate: toOptionalString(args.startDate),
          endDate: toOptionalString(args.endDate),
          institutionId: toOptionalString(args.institutionId),
        })
      );
    }
    case "list_car_loan_rates": {
      return unwrapApiResult(await listCarLoanRates(env));
    }
    case "get_car_loan_rates_by_institution": {
      return unwrapApiResult(
        await getCarLoanRatesByInstitution(env, {
          institutionId: toRequiredString(args.institutionId, "institutionId"),
        })
      );
    }
    case "get_car_loan_rates_time_series": {
      return unwrapApiResult(
        await getCarLoanRatesTimeSeries(env, {
          date: toOptionalString(args.date),
          startDate: toOptionalString(args.startDate),
          endDate: toOptionalString(args.endDate),
          institutionId: toOptionalString(args.institutionId),
        })
      );
    }
    case "list_credit_card_rates": {
      return unwrapApiResult(await listCreditCardRates(env));
    }
    case "get_credit_card_rates_by_issuer": {
      return unwrapApiResult(
        await getCreditCardRatesByIssuer(env, {
          issuerId: toRequiredString(args.issuerId, "issuerId"),
        })
      );
    }
    case "get_credit_card_rates_time_series": {
      return unwrapApiResult(
        await getCreditCardRatesTimeSeries(env, {
          date: toOptionalString(args.date),
          startDate: toOptionalString(args.startDate),
          endDate: toOptionalString(args.endDate),
          issuerId: toOptionalString(args.issuerId),
        })
      );
    }
    default: {
      throw new JsonRpcResponseError(-32_601, `Tool not found: ${name}`);
    }
  }
}

function unwrapApiResult(result: ApiResult) {
  if (result.status < 200 || result.status >= 300) {
    throw new McpToolError(
      `API request failed with status ${result.status}`,
      result.status,
      result.body
    );
  }

  return result.body;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// By the time these run, Value.Check has already confirmed the argument
// (if present) matches the tool's string-typed schema field, so no numeric
// coercion is needed or wanted here: a number is rejected earlier as an
// invalid param, never silently stringified.
function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function toRequiredString(value: unknown, name: string): string {
  const normalized = toOptionalString(value);

  if (!normalized) {
    throw new JsonRpcResponseError(
      -32_602,
      `Invalid params: ${name} is required`
    );
  }

  return normalized;
}
