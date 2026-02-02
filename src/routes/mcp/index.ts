import { Hono } from "hono";
import { cors } from "hono/cors";
import { Environment } from "../../lib/environment";
import { MCP_TOOLS, executeTool } from "./tools";
import {
  McpRequest,
  McpResponse,
  McpInitializeResult,
  McpToolsListResponse,
  McpToolCallParams,
  MCP_ERROR_CODES,
} from "./types";

const MCP_PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = {
  name: "ratesapi-mcp",
  version: "1.0.0",
};

const routes = new Hono<{ Bindings: Environment }>();

// Enable CORS for MCP endpoints
routes.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  })
);

/**
 * MCP Server Info - GET endpoint for discovery
 * Returns basic information about the MCP server
 */
routes.get("/", async (c) => {
  return c.json({
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
    protocolVersion: MCP_PROTOCOL_VERSION,
    description:
      "MCP server for accessing New Zealand lending rates data. Provides tools to query mortgage, personal loan, car loan, and credit card rates from major NZ financial institutions.",
    capabilities: {
      tools: {},
    },
    toolCount: MCP_TOOLS.length,
    documentation: "https://docs.ratesapi.nz",
  });
});

/**
 * MCP JSON-RPC endpoint - POST
 * Handles all MCP protocol messages
 */
routes.post("/", async (c) => {
  let request: McpRequest;

  try {
    request = await c.req.json<McpRequest>();
  } catch {
    return c.json(
      createErrorResponse(null, MCP_ERROR_CODES.PARSE_ERROR, "Parse error"),
      400
    );
  }

  // Validate JSON-RPC format
  if (request.jsonrpc !== "2.0" || !request.method) {
    return c.json(
      createErrorResponse(
        request?.id ?? null,
        MCP_ERROR_CODES.INVALID_REQUEST,
        "Invalid Request"
      ),
      400
    );
  }

  const db = c.env.RATESAPI_DB;

  // Handle different MCP methods
  switch (request.method) {
    case "initialize":
      return c.json(handleInitialize(request.id));

    case "notifications/initialized":
      // Client notification that initialization is complete - no response needed
      return c.json(createSuccessResponse(request.id, {}));

    case "tools/list":
      return c.json(handleToolsList(request.id));

    case "tools/call":
      return c.json(await handleToolCall(request.id, request.params, db));

    case "ping":
      return c.json(createSuccessResponse(request.id, {}));

    default:
      return c.json(
        createErrorResponse(
          request.id,
          MCP_ERROR_CODES.METHOD_NOT_FOUND,
          `Method not found: ${request.method}`
        ),
        404
      );
  }
});

/**
 * SSE endpoint for Server-Sent Events transport
 * Some MCP clients prefer SSE for real-time communication
 */
routes.get("/sse", async (c) => {
  // Return info about the SSE endpoint
  return c.json({
    message: "SSE transport not implemented. Please use the JSON-RPC endpoint at POST /api/v1/mcp",
    endpoint: "/api/v1/mcp",
    documentation: "https://docs.ratesapi.nz",
  });
});

/**
 * Handle initialize request
 */
function handleInitialize(requestId: string | number): McpResponse {
  const result: McpInitializeResult = {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {
      tools: {},
    },
    serverInfo: SERVER_INFO,
  };

  return createSuccessResponse(requestId, result);
}

/**
 * Handle tools/list request
 */
function handleToolsList(requestId: string | number): McpResponse {
  const result: McpToolsListResponse = {
    tools: MCP_TOOLS,
  };

  return createSuccessResponse(requestId, result);
}

/**
 * Handle tools/call request
 */
async function handleToolCall(
  requestId: string | number,
  params: Record<string, unknown> | undefined,
  db: import("@cloudflare/workers-types").D1Database
): Promise<McpResponse> {
  if (!params) {
    return createErrorResponse(
      requestId,
      MCP_ERROR_CODES.INVALID_PARAMS,
      "Missing params"
    );
  }

  const { name, arguments: args } = params as unknown as McpToolCallParams;

  if (!name) {
    return createErrorResponse(
      requestId,
      MCP_ERROR_CODES.INVALID_PARAMS,
      "Missing tool name"
    );
  }

  // Check if tool exists
  const tool = MCP_TOOLS.find((t) => t.name === name);
  if (!tool) {
    return createErrorResponse(
      requestId,
      MCP_ERROR_CODES.INVALID_PARAMS,
      `Unknown tool: ${name}`
    );
  }

  // Execute the tool
  const result = await executeTool(name, args ?? {}, db);

  return createSuccessResponse(requestId, result);
}

/**
 * Create a success response
 */
function createSuccessResponse(
  id: string | number | null,
  result: unknown
): McpResponse {
  return {
    jsonrpc: "2.0",
    id: id ?? 0,
    result,
  };
}

/**
 * Create an error response
 */
function createErrorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): McpResponse {
  return {
    jsonrpc: "2.0",
    id: id ?? 0,
    error: {
      code,
      message,
      data,
    },
  };
}

export { routes };
