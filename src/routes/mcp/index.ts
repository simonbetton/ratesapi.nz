import { OpenAPIHono } from "@hono/zod-openapi";
import { Context } from "hono";
import { Environment } from "../../lib/environment";

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
};

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

const routes = new OpenAPIHono<{ Bindings: Environment }>();

routes.post("/", async (c) => {
  let body: JsonRpcRequest;

  try {
    body = await c.req.json();
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

    return c.json(response, 400);
  }

  try {
    const { id, hasId, method, params } = parseJsonRpcRequest(body);

    const result = await handleMethod(method, params, c);

    if (!hasId) {
      return c.body(null, 204);
    }

    const response: JsonRpcResponse = {
      jsonrpc: "2.0",
      id,
      result,
    };

    return c.json(response);
  } catch (error) {
    const { id, hasId } = parseRequestId(body);

    if (!hasId) {
      return c.body(null, 204);
    }

    const response: JsonRpcResponse = {
      jsonrpc: "2.0",
      id,
      error: toJsonRpcError(error),
    };

    return c.json(response);
  }
});

function parseJsonRpcRequest(body: JsonRpcRequest) {
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

function parseRequestId(body: JsonRpcRequest) {
  const hasId = Object.prototype.hasOwnProperty.call(body, "id");
  const id = hasId ? body.id ?? null : null;

  if (hasId && id !== null && typeof id !== "string" && typeof id !== "number") {
    throw new JsonRpcErrorResponse(-32600, "Invalid Request");
  }

  return { id, hasId };
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

async function handleMethod(
  method: string,
  params: unknown,
  c: Context<{ Bindings: Environment }>
) {
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
      return handleToolCall(params, c);
    default:
      throw new JsonRpcErrorResponse(-32601, `Method not found: ${method}`);
  }
}

async function handleToolCall(
  params: unknown,
  c: Context<{ Bindings: Environment }>
) {
  if (!isRecord(params)) {
    throw new JsonRpcErrorResponse(-32602, "Invalid params");
  }

  const name = params.name;
  const args = params.arguments;

  if (typeof name !== "string" || name.length === 0) {
    throw new JsonRpcErrorResponse(-32602, "Invalid params: missing tool name");
  }

  if (args !== undefined && !isRecord(args)) {
    throw new JsonRpcErrorResponse(-32602, "Invalid params: arguments must be an object");
  }

  try {
    const result = await callTool(name, (args ?? {}) as Record<string, unknown>, c);

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
  c: Context<{ Bindings: Environment }>
) {
  switch (name) {
    case "list_mortgage_rates":
      return fetchApi(c, "/api/v1/mortgage-rates", {
        termInMonths: toOptionalString(args.termInMonths),
      });
    case "get_mortgage_rates_by_institution":
      return fetchApi(
        c,
        `/api/v1/mortgage-rates/${encodeURIComponent(
          toRequiredString(args.institutionId, "institutionId")
        )}`,
        {
          termInMonths: toOptionalString(args.termInMonths),
        }
      );
    case "get_mortgage_rates_time_series":
      return fetchApi(c, "/api/v1/mortgage-rates/time-series", {
        date: toOptionalString(args.date),
        startDate: toOptionalString(args.startDate),
        endDate: toOptionalString(args.endDate),
        institutionId: toOptionalString(args.institutionId),
        termInMonths: toOptionalString(args.termInMonths),
      });
    case "list_personal_loan_rates":
      return fetchApi(c, "/api/v1/personal-loan-rates");
    case "get_personal_loan_rates_by_institution":
      return fetchApi(
        c,
        `/api/v1/personal-loan-rates/${encodeURIComponent(
          toRequiredString(args.institutionId, "institutionId")
        )}`
      );
    case "get_personal_loan_rates_time_series":
      return fetchApi(c, "/api/v1/personal-loan-rates/time-series", {
        date: toOptionalString(args.date),
        startDate: toOptionalString(args.startDate),
        endDate: toOptionalString(args.endDate),
        institutionId: toOptionalString(args.institutionId),
      });
    case "list_car_loan_rates":
      return fetchApi(c, "/api/v1/car-loan-rates");
    case "get_car_loan_rates_by_institution":
      return fetchApi(
        c,
        `/api/v1/car-loan-rates/${encodeURIComponent(
          toRequiredString(args.institutionId, "institutionId")
        )}`
      );
    case "get_car_loan_rates_time_series":
      return fetchApi(c, "/api/v1/car-loan-rates/time-series", {
        date: toOptionalString(args.date),
        startDate: toOptionalString(args.startDate),
        endDate: toOptionalString(args.endDate),
        institutionId: toOptionalString(args.institutionId),
      });
    case "list_credit_card_rates":
      return fetchApi(c, "/api/v1/credit-card-rates");
    case "get_credit_card_rates_by_issuer":
      return fetchApi(
        c,
        `/api/v1/credit-card-rates/${encodeURIComponent(
          toRequiredString(args.issuerId, "issuerId")
        )}`
      );
    case "get_credit_card_rates_time_series":
      return fetchApi(c, "/api/v1/credit-card-rates/time-series", {
        date: toOptionalString(args.date),
        startDate: toOptionalString(args.startDate),
        endDate: toOptionalString(args.endDate),
        issuerId: toOptionalString(args.issuerId),
      });
    default:
      throw new JsonRpcErrorResponse(-32601, `Tool not found: ${name}`);
  }
}

async function fetchApi(
  c: Context<{ Bindings: Environment }>,
  pathname: string,
  query?: Record<string, string | undefined>
) {
  const url = new URL(c.req.url);
  url.pathname = pathname;
  url.search = "";

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      accept: "application/json",
    },
  });

  const body = await readJsonOrText(response);

  if (!response.ok) {
    throw new McpToolError(
      `API request failed with status ${response.status}`,
      response.status,
      body
    );
  }

  return body;
}

async function readJsonOrText(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
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
    throw new JsonRpcErrorResponse(-32602, `Invalid params: ${name} is required`);
  }

  return normalized;
}

export { routes };
