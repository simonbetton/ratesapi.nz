import { Elysia } from "elysia";
import { type ApiResult } from "../../lib/api-result";
import { type Environment } from "../../lib/environment";
import { type GetEnv } from "../../lib/routing";
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

type JsonRpcError = {
  code: number;
  message: string;
  data?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: JsonRpcError;
};

type McpTool = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: boolean;
  };
};

class JsonRpcErrorResponse extends Error {
  code: number;
  data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

class McpToolError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

const MCP_PROTOCOL_VERSION = "2024-11-05";

const MCP_SERVER_INFO = {
  name: "ratesapi-mcp",
  version: "1.0.0",
};

const MCP_TOOLS: McpTool[] = [
  {
    name: "list_mortgage_rates",
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
  },
  {
    name: "get_mortgage_rates_by_institution",
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
  },
  {
    name: "get_mortgage_rates_time_series",
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
  },
  {
    name: "list_personal_loan_rates",
    description: "List latest personal loan rates for all institutions.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_personal_loan_rates_by_institution",
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
  },
  {
    name: "get_personal_loan_rates_time_series",
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
  },
  {
    name: "list_car_loan_rates",
    description: "List latest car loan rates for all institutions.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_car_loan_rates_by_institution",
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
  },
  {
    name: "get_car_loan_rates_time_series",
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
  },
  {
    name: "list_credit_card_rates",
    description: "List latest credit card rates for all issuers.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_credit_card_rates_by_issuer",
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
  },
  {
    name: "get_credit_card_rates_time_series",
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
  },
];

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
            code: -32700,
            message: "Parse error",
            data: error instanceof Error ? error.message : undefined,
          },
        };

        return status(400, response);
      }

      try {
        const { id, hasId, method, params } = parseJsonRpcRequest(body);

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
        const { id, hasId } = parseRequestId(body);

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
    },
  );
}

function parseJsonRpcRequest(body: unknown) {
  if (!isRecord(body)) {
    throw new JsonRpcErrorResponse(-32600, "Invalid Request");
  }

  if (body.jsonrpc !== "2.0") {
    throw new JsonRpcErrorResponse(-32600, "Invalid Request");
  }

  if (typeof body.method !== "string" || body.method.length === 0) {
    throw new JsonRpcErrorResponse(-32600, "Invalid Request");
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
    throw new JsonRpcErrorResponse(-32600, "Invalid Request");
  }

  return { id: null, hasId };
}

function toJsonRpcError(error: unknown): JsonRpcError {
  if (error instanceof JsonRpcErrorResponse) {
    return {
      code: error.code,
      message: error.message,
      data: error.data,
    };
  }

  return {
    code: -32603,
    message: "Internal error",
    data: error instanceof Error ? error.message : undefined,
  };
}

async function handleMethod(method: string, params: unknown, getEnv: GetEnv) {
  switch (method) {
    case "initialize":
      return {
        protocolVersion: MCP_PROTOCOL_VERSION,
        serverInfo: MCP_SERVER_INFO,
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
      };
    case "ping":
      return {};
    case "tools/list":
      return {
        tools: MCP_TOOLS,
      };
    case "tools/call":
      return handleToolCall(params, getEnv);
    default:
      throw new JsonRpcErrorResponse(-32601, `Method not found: ${method}`);
  }
}

async function handleToolCall(params: unknown, getEnv: GetEnv) {
  if (!isRecord(params)) {
    throw new JsonRpcErrorResponse(-32602, "Invalid params");
  }

  const name = params.name;
  const args = params.arguments;

  if (typeof name !== "string" || name.length === 0) {
    throw new JsonRpcErrorResponse(-32602, "Invalid params: missing tool name");
  }

  if (args !== undefined && !isRecord(args)) {
    throw new JsonRpcErrorResponse(
      -32602,
      "Invalid params: arguments must be an object",
    );
  }

  try {
    const result = await callTool(name, args ?? {}, getEnv());

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
              2,
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
  env: Environment,
) {
  switch (name) {
    case "list_mortgage_rates":
      return unwrapApiResult(
        await listMortgageRates(env, {
          termInMonths: toOptionalString(args.termInMonths),
        }),
      );
    case "get_mortgage_rates_by_institution":
      return unwrapApiResult(
        await getMortgageRatesByInstitution(
          env,
          {
            institutionId: toRequiredString(
              args.institutionId,
              "institutionId",
            ),
          },
          {
            termInMonths: toOptionalString(args.termInMonths),
          },
        ),
      );
    case "get_mortgage_rates_time_series":
      return unwrapApiResult(
        await getMortgageRatesTimeSeries(env, {
          date: toOptionalString(args.date),
          startDate: toOptionalString(args.startDate),
          endDate: toOptionalString(args.endDate),
          institutionId: toOptionalString(args.institutionId),
          termInMonths: toOptionalString(args.termInMonths),
        }),
      );
    case "list_personal_loan_rates":
      return unwrapApiResult(await listPersonalLoanRates(env));
    case "get_personal_loan_rates_by_institution":
      return unwrapApiResult(
        await getPersonalLoanRatesByInstitution(env, {
          institutionId: toRequiredString(args.institutionId, "institutionId"),
        }),
      );
    case "get_personal_loan_rates_time_series":
      return unwrapApiResult(
        await getPersonalLoanRatesTimeSeries(env, {
          date: toOptionalString(args.date),
          startDate: toOptionalString(args.startDate),
          endDate: toOptionalString(args.endDate),
          institutionId: toOptionalString(args.institutionId),
        }),
      );
    case "list_car_loan_rates":
      return unwrapApiResult(await listCarLoanRates(env));
    case "get_car_loan_rates_by_institution":
      return unwrapApiResult(
        await getCarLoanRatesByInstitution(env, {
          institutionId: toRequiredString(args.institutionId, "institutionId"),
        }),
      );
    case "get_car_loan_rates_time_series":
      return unwrapApiResult(
        await getCarLoanRatesTimeSeries(env, {
          date: toOptionalString(args.date),
          startDate: toOptionalString(args.startDate),
          endDate: toOptionalString(args.endDate),
          institutionId: toOptionalString(args.institutionId),
        }),
      );
    case "list_credit_card_rates":
      return unwrapApiResult(await listCreditCardRates(env));
    case "get_credit_card_rates_by_issuer":
      return unwrapApiResult(
        await getCreditCardRatesByIssuer(env, {
          issuerId: toRequiredString(args.issuerId, "issuerId"),
        }),
      );
    case "get_credit_card_rates_time_series":
      return unwrapApiResult(
        await getCreditCardRatesTimeSeries(env, {
          date: toOptionalString(args.date),
          startDate: toOptionalString(args.startDate),
          endDate: toOptionalString(args.endDate),
          issuerId: toOptionalString(args.issuerId),
        }),
      );
    default:
      throw new JsonRpcErrorResponse(-32601, `Tool not found: ${name}`);
  }
}

function unwrapApiResult(result: ApiResult) {
  if (result.status < 200 || result.status >= 300) {
    throw new McpToolError(
      `API request failed with status ${result.status}`,
      result.status,
      result.body,
    );
  }

  return result.body;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return value.toString();
  }

  return undefined;
}

function toRequiredString(value: unknown, name: string): string {
  const normalized = toOptionalString(value);

  if (!normalized) {
    throw new JsonRpcErrorResponse(
      -32602,
      `Invalid params: ${name} is required`,
    );
  }

  return normalized;
}
