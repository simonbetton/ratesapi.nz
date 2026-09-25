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
import {
  hasFeature,
  isProtocolError,
  JSON_RPC_ERRORS,
  META_SERVER_INFO,
  MODERN_PROTOCOL_VERSION,
  negotiateLegacyVersion,
  resolveEra,
  SUPPORTED_PROTOCOL_VERSIONS,
  validateModernRequest,
} from "./protocol";
import type { Era, ProtocolError } from "./protocol";

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
  title: string;
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

const MCP_SERVER_INFO = {
  name: "ratesapi-mcp",
  title: "Rates API",
  version: "1.1.0",
  description:
    "Interest rates of New Zealand financial institutions for mortgages, personal loans, car loans, and credit cards.",
  websiteUrl: "https://www.ratesapi.nz",
};

const MCP_INSTRUCTIONS = [
  "Rates API gives the interest rates of New Zealand financial institutions.",
  "Use a list tool to get the newest rates, a by-institution or by-issuer tool for one provider, and a time-series tool for snapshots of earlier rates.",
  "Send all tool arguments as strings. Dates use the YYYY-MM-DD format.",
].join(" ");

const MCP_CAPABILITIES = { tools: { listChanged: false } };

// The tool list only changes when the API is deployed.
const TOOLS_CACHE_HINT = { ttlMs: 3_600_000, cacheScope: "public" } as const;

// Every tool only reads the Rates API dataset.
const READ_ONLY_ANNOTATIONS = { readOnlyHint: true, openWorldHint: false };

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
    title: "List mortgage rates",
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
    title: "Get mortgage rates for one institution",
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
    title: "Get historical mortgage rates",
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
    title: "List personal loan rates",
    description: "List latest personal loan rates for all institutions.",
    inputSchema: Type.Object({}, { additionalProperties: false }),
  },
  {
    name: "get_personal_loan_rates_by_institution",
    title: "Get personal loan rates for one institution",
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
    title: "Get historical personal loan rates",
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
    title: "List car loan rates",
    description: "List latest car loan rates for all institutions.",
    inputSchema: Type.Object({}, { additionalProperties: false }),
  },
  {
    name: "get_car_loan_rates_by_institution",
    title: "Get car loan rates for one institution",
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
    title: "Get historical car loan rates",
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
    title: "List credit card rates",
    description: "List latest credit card rates for all issuers.",
    inputSchema: Type.Object({}, { additionalProperties: false }),
  },
  {
    name: "get_credit_card_rates_by_issuer",
    title: "Get credit card rates for one issuer",
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
    title: "Get historical credit card rates",
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

// Deterministic order (the MCP_TOOLS order), as 2026-07-28 recommends.
const MCP_TOOL_LIST = MCP_TOOLS.map((tool) => ({
  ...tool,
  annotations: READ_ONLY_ANNOTATIONS,
}));

export function createMcpRoutes(getEnv: GetEnv) {
  return (
    new Elysia({ prefix: "/mcp" })
      .post(
        "/",
        async ({ request, status }) => {
          let body: unknown;

          try {
            body = await request.json();
          } catch (error) {
            return status(
              400,
              errorResponse(null, {
                code: JSON_RPC_ERRORS.parseError,
                message: "Parse error",
                data: error instanceof Error ? error.message : undefined,
              })
            );
          }

          const reply = Array.isArray(body)
            ? await handleBatch(body, request.headers, getEnv)
            : await handleMessage(body, request.headers, getEnv);

          // Notifications and all-notification batches get 202 with no body
          // (transports/streamable-http, "Sending Messages").
          return reply.body === undefined
            ? new Response(null, { status: reply.httpStatus })
            : status(reply.httpStatus, reply.body);
        },
        { detail: { hide: true } }
      )
      // Streamable HTTP servers without a standalone SSE stream answer GET
      // (and DELETE, for legacy session teardown) with 405.
      .get("/", ({ set, status }) => methodNotAllowed(set, status), {
        detail: { hide: true },
      })
      .delete("/", ({ set, status }) => methodNotAllowed(set, status), {
        detail: { hide: true },
      })
  );
}

interface Reply {
  httpStatus: number;
  body?: JsonRpcResponse | JsonRpcResponse[];
}

function methodNotAllowed(
  set: { headers: Record<string, unknown> },
  status: (code: 405, body: JsonRpcResponse) => unknown
) {
  set.headers.allow = "POST";
  return status(
    405,
    errorResponse(null, {
      code: JSON_RPC_ERRORS.invalidRequest,
      message: "Method not allowed. Send each JSON-RPC message in a POST.",
    })
  );
}

function errorResponse(id: JsonRpcId, error: JsonRpcError): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error };
}

function protocolFailure(id: JsonRpcId, failure: ProtocolError): Reply {
  return {
    httpStatus: failure.httpStatus,
    body: errorResponse(id, {
      code: failure.code,
      message: failure.message,
      data: failure.data,
    }),
  };
}

// JSON-RPC batches exist only in 2025-03-26, which clients without the
// MCP-Protocol-Version header may be speaking. Later revisions forbid them.
async function handleBatch(
  messages: unknown[],
  headers: Headers,
  getEnv: GetEnv
): Promise<Reply> {
  const headerVersion = headers.get("mcp-protocol-version");
  if (headerVersion !== null && headerVersion !== "2025-03-26") {
    return protocolFailure(null, {
      httpStatus: 400,
      code: JSON_RPC_ERRORS.invalidRequest,
      message: `Batch requests are not supported in protocol version ${headerVersion}`,
    });
  }
  if (messages.length === 0) {
    return {
      httpStatus: 200,
      body: errorResponse(null, {
        code: JSON_RPC_ERRORS.invalidRequest,
        message: "Invalid Request",
      }),
    };
  }

  const replies = await Promise.all(
    messages.map((message) => handleMessage(message, headers, getEnv))
  );
  const responses = replies.flatMap((reply) =>
    reply.body === undefined || Array.isArray(reply.body) ? [] : [reply.body]
  );
  return responses.length === 0
    ? { httpStatus: 202 }
    : { httpStatus: 200, body: responses };
}

async function handleMessage(
  body: unknown,
  headers: Headers,
  getEnv: GetEnv
): Promise<Reply> {
  // Parsing the envelope (jsonrpc/method/id shape) is tracked separately
  // from dispatching the method: an invalid envelope must never be
  // treated as a notification, and recovering an id for its error
  // response must never itself throw.
  let envelope: ReturnType<typeof parseJsonRpcRequest>;

  try {
    envelope = parseJsonRpcRequest(body);
  } catch (error) {
    const modern =
      headers.get("mcp-protocol-version") === MODERN_PROTOCOL_VERSION;
    return {
      httpStatus: modern ? 400 : 200,
      body: errorResponse(recoverRequestId(body), toJsonRpcError(error)),
    };
  }

  const { id, hasId, method, params } = envelope;
  const era = resolveEra(headers.get("mcp-protocol-version"), method, params);

  if (isProtocolError(era)) {
    return protocolFailure(id, era);
  }

  // A notification needs no reply, and none of this server's methods act on
  // one, so it is accepted without being dispatched.
  if (!hasId) {
    return { httpStatus: 202 };
  }

  if (era.kind === "modern") {
    const invalid =
      id === null
        ? {
            httpStatus: 400,
            code: JSON_RPC_ERRORS.invalidRequest,
            message: "Invalid Request: id must not be null",
          }
        : validateModernRequest(headers, method, params);
    if (invalid) {
      return protocolFailure(id, invalid);
    }
  }

  try {
    const result = await handleMethod(era, method, params, getEnv);
    return {
      httpStatus: 200,
      body: {
        jsonrpc: "2.0",
        id,
        result:
          era.kind === "modern"
            ? {
                resultType: "complete",
                ...result,
                _meta: { [META_SERVER_INFO]: MCP_SERVER_INFO },
              }
            : result,
      },
    };
  } catch (error) {
    const rpcError = toJsonRpcError(error);
    // Modern servers answer an unknown RPC method with 404 so clients can
    // tell it apart from a legacy HTTP+SSE endpoint.
    const httpStatus =
      era.kind === "modern" && rpcError.code === JSON_RPC_ERRORS.methodNotFound
        ? 404
        : 200;
    return { httpStatus, body: errorResponse(id, rpcError) };
  }
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

async function handleMethod(
  era: Era,
  method: string,
  params: unknown,
  getEnv: GetEnv
): Promise<Record<string, unknown>> {
  if (era.kind === "modern") {
    switch (method) {
      case "server/discover": {
        return {
          supportedVersions: SUPPORTED_PROTOCOL_VERSIONS,
          capabilities: MCP_CAPABILITIES,
          instructions: MCP_INSTRUCTIONS,
          ...TOOLS_CACHE_HINT,
        };
      }
      case "tools/list": {
        return { tools: MCP_TOOL_LIST, ...TOOLS_CACHE_HINT };
      }
      case "tools/call": {
        return await handleToolCall(era, params, getEnv);
      }
      default: {
        // Includes `ping`, which 2026-07-28 removed.
        throw new JsonRpcResponseError(
          JSON_RPC_ERRORS.methodNotFound,
          `Method not found: ${method}`
        );
      }
    }
  }

  switch (method) {
    case "initialize": {
      return {
        protocolVersion: negotiateLegacyVersion(
          isRecord(params) ? params.protocolVersion : undefined
        ),
        capabilities: MCP_CAPABILITIES,
        serverInfo: MCP_SERVER_INFO,
        instructions: MCP_INSTRUCTIONS,
      };
    }
    case "ping": {
      return {};
    }
    case "tools/list": {
      return { tools: MCP_TOOL_LIST };
    }
    case "tools/call": {
      return await handleToolCall(era, params, getEnv);
    }
    default: {
      throw new JsonRpcResponseError(
        JSON_RPC_ERRORS.methodNotFound,
        `Method not found: ${method}`
      );
    }
  }
}

function toolErrorResult(text: string) {
  return { isError: true, content: [{ type: "text", text }] };
}

async function handleToolCall(era: Era, params: unknown, getEnv: GetEnv) {
  if (!isRecord(params)) {
    throw new JsonRpcResponseError(
      JSON_RPC_ERRORS.invalidParams,
      "Invalid params"
    );
  }

  const { name } = params;
  const args = params.arguments;

  if (typeof name !== "string" || name.length === 0) {
    throw new JsonRpcResponseError(
      JSON_RPC_ERRORS.invalidParams,
      "Invalid params: missing tool name"
    );
  }

  // 2025-11-25 (SEP-1303) moved unknown tools to -32602, and input
  // validation failures into tool results so the model can correct them.
  const toolErrorsInResults = hasFeature(era, "2025-11-25");
  const tool = MCP_TOOLS_BY_NAME.get(name);

  if (!tool) {
    throw toolErrorsInResults
      ? new JsonRpcResponseError(
          JSON_RPC_ERRORS.invalidParams,
          `Unknown tool: ${name}`
        )
      : new JsonRpcResponseError(
          JSON_RPC_ERRORS.methodNotFound,
          `Tool not found: ${name}`
        );
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

    if (toolErrorsInResults) {
      return toolErrorResult(`Invalid arguments: ${detail}`);
    }
    throw new JsonRpcResponseError(
      JSON_RPC_ERRORS.invalidParams,
      `Invalid params: ${detail}`
    );
  }

  try {
    const result = await callTool(
      name,
      toolArguments as Record<string, unknown>,
      getEnv()
    );
    const content = [{ type: "text", text: JSON.stringify(result, null, 2) }];

    // `structuredContent` exists from 2025-06-18; the text block keeps the
    // same JSON for older clients.
    return hasFeature(era, "2025-06-18")
      ? { content, structuredContent: result }
      : { content };
  } catch (error) {
    if (error instanceof McpToolError) {
      return toolErrorResult(
        JSON.stringify(
          {
            message: error.message,
            status: error.status,
            body: error.body,
          },
          null,
          2
        )
      );
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
