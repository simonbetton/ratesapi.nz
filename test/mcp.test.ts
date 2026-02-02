import { describe, it, expect, beforeAll } from "vitest";
import { env, SELF } from "cloudflare:test";

// Helper to make JSON-RPC requests
async function mcpRequest(method: string, params?: Record<string, unknown>, id: number | string = 1) {
  const response = await SELF.fetch("http://localhost/api/v1/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    }),
  });
  return response;
}

describe("MCP Endpoint", () => {
  describe("GET /api/v1/mcp - Server Info", () => {
    it("should return server info", async () => {
      const response = await SELF.fetch("http://localhost/api/v1/mcp");
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("name", "ratesapi-mcp");
      expect(data).toHaveProperty("version", "1.0.0");
      expect(data).toHaveProperty("protocolVersion");
      expect(data).toHaveProperty("capabilities");
      expect(data).toHaveProperty("toolCount");
      expect(data.toolCount).toBeGreaterThan(0);
    });

    it("should have CORS headers", async () => {
      const response = await SELF.fetch("http://localhost/api/v1/mcp", {
        method: "OPTIONS",
      });
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("POST /api/v1/mcp - JSON-RPC Protocol", () => {
    describe("Protocol Validation", () => {
      it("should reject invalid JSON", async () => {
        const response = await SELF.fetch("http://localhost/api/v1/mcp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "invalid json{",
        });
        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.error).toBeDefined();
        expect(data.error.code).toBe(-32700); // Parse error
      });

      it("should reject requests without jsonrpc version", async () => {
        const response = await SELF.fetch("http://localhost/api/v1/mcp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: 1, method: "initialize" }),
        });
        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.error).toBeDefined();
        expect(data.error.code).toBe(-32600); // Invalid request
      });

      it("should reject requests without method", async () => {
        const response = await SELF.fetch("http://localhost/api/v1/mcp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1 }),
        });
        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.error).toBeDefined();
        expect(data.error.code).toBe(-32600); // Invalid request
      });

      it("should reject unknown methods", async () => {
        const response = await mcpRequest("unknown/method");
        expect(response.status).toBe(404);

        const data = await response.json();
        expect(data.error).toBeDefined();
        expect(data.error.code).toBe(-32601); // Method not found
      });
    });

    describe("initialize", () => {
      it("should handle initialize request", async () => {
        const response = await mcpRequest("initialize", {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        });
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.jsonrpc).toBe("2.0");
        expect(data.result).toBeDefined();
        expect(data.result.protocolVersion).toBe("2024-11-05");
        expect(data.result.serverInfo).toHaveProperty("name", "ratesapi-mcp");
        expect(data.result.serverInfo).toHaveProperty("version", "1.0.0");
        expect(data.result.capabilities).toHaveProperty("tools");
      });

      it("should handle notifications/initialized", async () => {
        const response = await mcpRequest("notifications/initialized");
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.result).toEqual({});
      });
    });

    describe("ping", () => {
      it("should respond to ping", async () => {
        const response = await mcpRequest("ping");
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.result).toEqual({});
      });
    });

    describe("tools/list", () => {
      it("should list all available tools", async () => {
        const response = await mcpRequest("tools/list");
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.result).toBeDefined();
        expect(data.result.tools).toBeInstanceOf(Array);
        expect(data.result.tools.length).toBeGreaterThan(0);
      });

      it("should include all expected tools", async () => {
        const response = await mcpRequest("tools/list");
        const data = await response.json();
        const toolNames = data.result.tools.map((t: { name: string }) => t.name);

        // Mortgage tools
        expect(toolNames).toContain("get_mortgage_rates");
        expect(toolNames).toContain("get_mortgage_rates_by_institution");
        expect(toolNames).toContain("get_mortgage_rates_time_series");

        // Personal loan tools
        expect(toolNames).toContain("get_personal_loan_rates");
        expect(toolNames).toContain("get_personal_loan_rates_by_institution");
        expect(toolNames).toContain("get_personal_loan_rates_time_series");

        // Car loan tools
        expect(toolNames).toContain("get_car_loan_rates");
        expect(toolNames).toContain("get_car_loan_rates_by_institution");
        expect(toolNames).toContain("get_car_loan_rates_time_series");

        // Credit card tools
        expect(toolNames).toContain("get_credit_card_rates");
        expect(toolNames).toContain("get_credit_card_rates_by_issuer");
        expect(toolNames).toContain("get_credit_card_rates_time_series");

        // Utility tools
        expect(toolNames).toContain("list_available_dates");
      });

      it("should have valid tool schemas", async () => {
        const response = await mcpRequest("tools/list");
        const data = await response.json();

        for (const tool of data.result.tools) {
          expect(tool).toHaveProperty("name");
          expect(tool).toHaveProperty("description");
          expect(tool).toHaveProperty("inputSchema");
          expect(tool.inputSchema).toHaveProperty("type", "object");
          expect(tool.inputSchema).toHaveProperty("properties");
        }
      });
    });

    describe("tools/call", () => {
      it("should reject calls without tool name", async () => {
        const response = await mcpRequest("tools/call", {
          arguments: {},
        });
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.error).toBeDefined();
        expect(data.error.code).toBe(-32602); // Invalid params
      });

      it("should reject calls with unknown tool", async () => {
        const response = await mcpRequest("tools/call", {
          name: "unknown_tool",
          arguments: {},
        });
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.error).toBeDefined();
        expect(data.error.code).toBe(-32602); // Invalid params
      });

      it("should handle missing params", async () => {
        const response = await mcpRequest("tools/call");
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.error).toBeDefined();
        expect(data.error.code).toBe(-32602); // Invalid params
      });
    });
  });
});

describe("MCP Tools", () => {
  describe("list_available_dates", () => {
    it("should require dataType parameter", async () => {
      const response = await mcpRequest("tools/call", {
        name: "list_available_dates",
        arguments: {},
      });
      const data = await response.json();

      expect(data.result).toBeDefined();
      expect(data.result.isError).toBe(true);
      expect(data.result.content[0].text).toContain("dataType is required");
    });

    it("should reject invalid dataType", async () => {
      const response = await mcpRequest("tools/call", {
        name: "list_available_dates",
        arguments: { dataType: "invalid-type" },
      });
      const data = await response.json();

      expect(data.result).toBeDefined();
      expect(data.result.isError).toBe(true);
      expect(data.result.content[0].text).toContain("Invalid dataType");
    });

    it("should accept valid dataType for mortgage-rates", async () => {
      const response = await mcpRequest("tools/call", {
        name: "list_available_dates",
        arguments: { dataType: "mortgage-rates" },
      });
      const data = await response.json();

      expect(data.result).toBeDefined();
      // May return empty array or error if no DB data, but should not have isError for valid type
      if (!data.result.isError) {
        const content = JSON.parse(data.result.content[0].text);
        expect(content).toHaveProperty("dataType", "mortgage-rates");
        expect(content).toHaveProperty("availableDates");
      }
    });
  });

  describe("get_mortgage_rates_by_institution", () => {
    it("should require institutionId parameter", async () => {
      const response = await mcpRequest("tools/call", {
        name: "get_mortgage_rates_by_institution",
        arguments: {},
      });
      const data = await response.json();

      expect(data.result).toBeDefined();
      expect(data.result.isError).toBe(true);
      expect(data.result.content[0].text).toContain("institutionId is required");
    });
  });

  describe("get_personal_loan_rates_by_institution", () => {
    it("should require institutionId parameter", async () => {
      const response = await mcpRequest("tools/call", {
        name: "get_personal_loan_rates_by_institution",
        arguments: {},
      });
      const data = await response.json();

      expect(data.result).toBeDefined();
      expect(data.result.isError).toBe(true);
      expect(data.result.content[0].text).toContain("institutionId is required");
    });
  });

  describe("get_car_loan_rates_by_institution", () => {
    it("should require institutionId parameter", async () => {
      const response = await mcpRequest("tools/call", {
        name: "get_car_loan_rates_by_institution",
        arguments: {},
      });
      const data = await response.json();

      expect(data.result).toBeDefined();
      expect(data.result.isError).toBe(true);
      expect(data.result.content[0].text).toContain("institutionId is required");
    });
  });

  describe("get_credit_card_rates_by_issuer", () => {
    it("should require issuerId parameter", async () => {
      const response = await mcpRequest("tools/call", {
        name: "get_credit_card_rates_by_issuer",
        arguments: {},
      });
      const data = await response.json();

      expect(data.result).toBeDefined();
      expect(data.result.isError).toBe(true);
      expect(data.result.content[0].text).toContain("issuerId is required");
    });
  });

  describe("Time series tools", () => {
    it("get_mortgage_rates_time_series should return result or error for date range", async () => {
      const response = await mcpRequest("tools/call", {
        name: "get_mortgage_rates_time_series",
        arguments: {
          startDate: "2025-03-01",
          endDate: "2025-01-01", // Invalid: end before start
        },
      });
      const data = await response.json();

      expect(data.result).toBeDefined();
      // Either returns "no historical data" (empty DB) or "start date cannot be after end date"
      expect(data.result.isError).toBe(true);
      const errorText = data.result.content[0].text;
      expect(
        errorText.includes("Start date cannot be after end date") ||
        errorText.includes("No historical data available")
      ).toBe(true);
    });

    it("get_personal_loan_rates_time_series should return result or error for date range", async () => {
      const response = await mcpRequest("tools/call", {
        name: "get_personal_loan_rates_time_series",
        arguments: {
          startDate: "2025-03-01",
          endDate: "2025-01-01",
        },
      });
      const data = await response.json();

      expect(data.result).toBeDefined();
      expect(data.result.isError).toBe(true);
      const errorText = data.result.content[0].text;
      expect(
        errorText.includes("Start date cannot be after end date") ||
        errorText.includes("No historical data available")
      ).toBe(true);
    });

    it("get_car_loan_rates_time_series should return result or error for date range", async () => {
      const response = await mcpRequest("tools/call", {
        name: "get_car_loan_rates_time_series",
        arguments: {
          startDate: "2025-03-01",
          endDate: "2025-01-01",
        },
      });
      const data = await response.json();

      expect(data.result).toBeDefined();
      expect(data.result.isError).toBe(true);
      const errorText = data.result.content[0].text;
      expect(
        errorText.includes("Start date cannot be after end date") ||
        errorText.includes("No historical data available")
      ).toBe(true);
    });

    it("get_credit_card_rates_time_series should return result or error for date range", async () => {
      const response = await mcpRequest("tools/call", {
        name: "get_credit_card_rates_time_series",
        arguments: {
          startDate: "2025-03-01",
          endDate: "2025-01-01",
        },
      });
      const data = await response.json();

      expect(data.result).toBeDefined();
      expect(data.result.isError).toBe(true);
      const errorText = data.result.content[0].text;
      expect(
        errorText.includes("Start date cannot be after end date") ||
        errorText.includes("No historical data available")
      ).toBe(true);
    });
  });
});

describe("MCP Protocol Flow", () => {
  it("should support full initialization flow", async () => {
    // Step 1: Initialize
    const initResponse = await mcpRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    });
    expect(initResponse.status).toBe(200);
    const initData = await initResponse.json();
    expect(initData.result.protocolVersion).toBe("2024-11-05");

    // Step 2: Initialized notification
    const notifyResponse = await mcpRequest("notifications/initialized", undefined, 2);
    expect(notifyResponse.status).toBe(200);

    // Step 3: List tools
    const toolsResponse = await mcpRequest("tools/list", undefined, 3);
    expect(toolsResponse.status).toBe(200);
    const toolsData = await toolsResponse.json();
    expect(toolsData.result.tools.length).toBeGreaterThan(0);
  });

  it("should maintain request ID in responses", async () => {
    const customId = "my-custom-id-123";
    const response = await mcpRequest("ping", undefined, customId);
    const data = await response.json();
    expect(data.id).toBe(customId);
  });

  it("should support numeric request IDs", async () => {
    const numericId = 42;
    const response = await mcpRequest("ping", undefined, numericId);
    const data = await response.json();
    expect(data.id).toBe(numericId);
  });
});
