import { Type } from "@sinclair/typebox";
import type { DocumentDecoration } from "elysia";

import {
  JSON_RPC_ERRORS,
  LEGACY_PROTOCOL_VERSIONS,
  META_CLIENT_CAPABILITIES,
  META_PROTOCOL_VERSION,
  MODERN_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
} from "./protocol";

// OpenAPI documentation for the MCP endpoint. It only describes the endpoint:
// the handler reads and checks the JSON-RPC body itself, so that it can send
// JSON-RPC errors. Do not add Elysia `body` or `response` schemas to the route.
//
// The JSON-RPC shapes are Elysia models, which the OpenAPI plugin publishes in
// `components.schemas`. The operation refers to them with `$ref`. Models add
// no validation unless a route hook names them.
//
// Text in this file follows ASD-STE100 Simplified Technical English, like
// src/lib/openapi.ts.

const mcpGuideUrl = "https://www.ratesapi.nz/docs/api-reference/ai-integration";

const JsonRpcRequestId = Type.Union([Type.String(), Type.Integer()], {
  description:
    "The ID of the request. The response contains the same ID. A message without an ID is a notification.",
});

const JsonRpcRequest = Type.Object({
  jsonrpc: Type.Literal("2.0", { description: "The JSON-RPC version." }),
  id: Type.Optional(JsonRpcRequestId),
  method: Type.String({
    description: "The MCP method.",
    examples: ["tools/call"],
  }),
  params: Type.Optional(
    Type.Object(
      {},
      {
        additionalProperties: true,
        description: `The parameters of the method. For \`${MODERN_PROTOCOL_VERSION}\`, \`_meta\` must contain \`${META_PROTOCOL_VERSION}\` and \`${META_CLIENT_CAPABILITIES}\`.`,
      }
    )
  ),
});

const JsonRpcError = Type.Object({
  code: Type.Integer({
    description: "The JSON-RPC error code.",
    examples: [JSON_RPC_ERRORS.methodNotFound],
  }),
  message: Type.String({ description: "A short description of the error." }),
  data: Type.Optional(
    Type.Unknown({ description: "More information about the error." })
  ),
});

const JsonRpcResponse = Type.Object({
  jsonrpc: Type.Literal("2.0", { description: "The JSON-RPC version." }),
  id: Type.Union([Type.String(), Type.Integer(), Type.Null()], {
    description:
      "The ID of the request. It is `null` if the server cannot read the ID of the request.",
  }),
  result: Type.Optional(
    Type.Object(
      {},
      {
        additionalProperties: true,
        description:
          "The result of the method. A response contains `result` or `error`, not both.",
      }
    )
  ),
  error: Type.Optional(JsonRpcError),
});

export const mcpModels = {
  McpMessage: JsonRpcRequest,
  McpResponse: JsonRpcResponse,
};

const messageRef = { $ref: "#/components/schemas/McpMessage" };
const responseRef = { $ref: "#/components/schemas/McpResponse" };

const modernMeta = {
  [META_PROTOCOL_VERSION]: MODERN_PROTOCOL_VERSION,
  [META_CLIENT_CAPABILITIES]: {},
};

function jsonRpcErrorExample(code: number, message: string) {
  return { jsonrpc: "2.0", id: "rates-1", error: { code, message } };
}

function toolList(tools: readonly { name: string; title: string }[]) {
  return tools.map((tool) => `- \`${tool.name}\`: ${tool.title}`);
}

function legacyVersionList() {
  const versions = LEGACY_PROTOCOL_VERSIONS.map((version) => `\`${version}\``);
  return `${versions.slice(0, -1).join(", ")}, and ${versions.at(-1)}`;
}

export function mcpOperationDetail(
  tools: readonly { name: string; title: string }[]
): DocumentDecoration {
  return {
    operationId: "sendMcpMessage",
    tags: ["MCP"],
    summary: "Send an MCP message",
    description: [
      "This endpoint is the MCP server of Rates API. MCP clients and AI agents use it to find and call the Rates API tools. The tools get the same data as the REST endpoints.",
      "",
      "The endpoint uses the Streamable HTTP transport and JSON-RPC 2.0. Send each message in a `POST` request. A `GET` or `DELETE` request gets HTTP 405. The server does not use sessions.",
      "",
      "Protocol versions:",
      "",
      `- \`${MODERN_PROTOCOL_VERSION}\` (current): Each request contains its protocol version, so you do not send \`initialize\`. Send the \`MCP-Protocol-Version\` and \`Mcp-Method\` headers. For \`tools/call\`, also send the \`Mcp-Name\` header. The headers must agree with the body.`,
      `- ${legacyVersionList()} (legacy): Send \`initialize\` first. Then send \`tools/list\` and \`tools/call\`.`,
      "",
      "Methods:",
      "",
      "- `server/discover`: Gets the supported versions, the capabilities, and the server information.",
      "- `tools/list`: Gets the list of tools and their input schemas.",
      "- `tools/call`: Uses one tool with the arguments that you send.",
      "- `initialize` and `ping`: Only for the legacy versions.",
      "",
      "Tools (all tools only read data, and all tool arguments are strings):",
      "",
      ...toolList(tools),
    ].join("\n"),
    externalDocs: {
      description: "MCP guide",
      url: mcpGuideUrl,
    },
    parameters: [
      {
        name: "MCP-Protocol-Version",
        in: "header",
        required: false,
        description: `The MCP protocol version. For \`${MODERN_PROTOCOL_VERSION}\`, this header is necessary. Legacy clients for \`2025-06-18\` and later send the version that \`initialize\` gave.`,
        schema: { type: "string", enum: SUPPORTED_PROTOCOL_VERSIONS },
        example: MODERN_PROTOCOL_VERSION,
      },
      {
        name: "Mcp-Method",
        in: "header",
        required: false,
        description: `The JSON-RPC method. For \`${MODERN_PROTOCOL_VERSION}\`, this header is necessary, and it must be the same as \`method\` in the body.`,
        schema: { type: "string" },
        example: "tools/call",
      },
      {
        name: "Mcp-Name",
        in: "header",
        required: false,
        description: `The tool name. For a \`${MODERN_PROTOCOL_VERSION}\` \`tools/call\` request, this header is necessary, and it must be the same as \`params.name\` in the body.`,
        schema: { type: "string" },
        example: "list_mortgage_rates",
      },
    ],
    requestBody: {
      required: true,
      description:
        "One JSON-RPC 2.0 message. Clients that use `2025-03-26` can also send a batch (an array of messages).",
      content: {
        "application/json": {
          schema: {
            oneOf: [
              messageRef,
              {
                type: "array",
                items: messageRef,
                minItems: 1,
                description: "A batch of messages. Only for `2025-03-26`.",
              },
            ],
          },
          examples: {
            toolsCall: {
              summary: "Call a tool",
              value: {
                jsonrpc: "2.0",
                id: "rates-1",
                method: "tools/call",
                params: {
                  name: "list_mortgage_rates",
                  arguments: { termInMonths: "12" },
                  _meta: modernMeta,
                },
              },
            },
            toolsList: {
              summary: "Get the list of tools",
              description: "Send `Mcp-Method: tools/list`, and no `Mcp-Name`.",
              value: {
                jsonrpc: "2.0",
                id: "rates-2",
                method: "tools/list",
                params: { _meta: modernMeta },
              },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description:
          "The JSON-RPC response. For a batch, the body is an array of responses. An internal error or a tool error also gets HTTP 200: the response contains `error`, or the result contains `isError: true`.",
        content: {
          "application/json": {
            schema: {
              oneOf: [responseRef, { type: "array", items: responseRef }],
            },
            example: {
              jsonrpc: "2.0",
              id: "rates-1",
              result: {
                resultType: "complete",
                content: [
                  {
                    type: "text",
                    text: '{"type":"MortgageRates","data":[…]}',
                  },
                ],
                structuredContent: { type: "MortgageRates", data: [] },
              },
            },
          },
        },
      },
      202: {
        description:
          "The message is a notification, or the batch contains only notifications. The response has no body.",
      },
      400: {
        description: [
          "The server cannot use the request. The body is a JSON-RPC error response. The error code gives the cause:",
          "",
          "- `-32700`: The body is not JSON.",
          `- \`-32600\`: The client sends a batch with a version other than \`2025-03-26\`. For \`${MODERN_PROTOCOL_VERSION}\`, a message that is not a correct JSON-RPC 2.0 request also gets this error.`,
          "- `-32020`: A necessary header is missing, or it does not agree with the body.",
          "- `-32602`: A necessary `_meta` field is missing.",
          "- `-32022`: The server does not support the protocol version. The error data contains the supported versions.",
        ].join("\n"),
        content: {
          "application/json": {
            schema: responseRef,
            example: jsonRpcErrorExample(
              JSON_RPC_ERRORS.headerMismatch,
              "Header mismatch: Missing required Mcp-Method header"
            ),
          },
        },
      },
      404: {
        description: `For \`${MODERN_PROTOCOL_VERSION}\`, the method does not exist (error \`-32601\`).`,
        content: {
          "application/json": {
            schema: responseRef,
            example: jsonRpcErrorExample(
              JSON_RPC_ERRORS.methodNotFound,
              "Method not found: resources/list"
            ),
          },
        },
      },
    },
  };
}
