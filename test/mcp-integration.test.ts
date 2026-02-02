import { describe, it, expect } from "vitest";
import { SELF } from "cloudflare:test";

// Helper to make JSON-RPC requests
async function mcpRequest(
  method: string,
  params?: Record<string, unknown>,
  id: number | string = 1
) {
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

// NOTE: These integration tests require a populated D1 database
// They are marked as skipped by default and should be run manually when
// testing against a real database with data
describe.skip("MCP Integration Tests with Database", () => {

  describe("get_mortgage_rates", () => {
    it("should retrieve all mortgage rates", async () => {
      const response = await mcpRequest("tools/call", {
        name: "get_mortgage_rates",
        arguments: {},
      });
      const data = await response.json();

      expect(data.result).toBeDefined();
      expect(data.result.isError).toBeUndefined();

      const content = JSON.parse(data.result.content[0].text);
      expect(content.type).toBe("MortgageRates");
      expect(content.data).toBeInstanceOf(Array);
      expect(content.data.length).toBeGreaterThan(0);
      expect(content.termsOfUse).toBeDefined();
      expect(content.timestamp).toBeDefined();
    });

    it("should filter mortgage rates by term", async () => {
      const response = await mcpRequest("tools/call", {
        name: "get_mortgage_rates",
        arguments: { termInMonths: "12" },
      });
      const data = await response.json();

      expect(data.result).toBeDefined();
      expect(data.result.isError).toBeUndefined();

      const content = JSON.parse(data.result.content[0].text);
      // All returned rates should be 12 months
      for (const institution of content.data) {
        for (const product of institution.products) {
          for (const rate of product.rates) {
            expect(rate.termInMonths).toBe(12);
          }
        }
      }
    });
  });

  describe("get_mortgage_rates_by_institution", () => {
    it("should retrieve rates for a specific institution", async () => {
      const response = await mcpRequest("tools/call", {
        name: "get_mortgage_rates_by_institution",
        arguments: { institutionId: "institution:test-bank" },
      });
      const data = await response.json();

      expect(data.result).toBeDefined();
      expect(data.result.isError).toBeUndefined();

      const content = JSON.parse(data.result.content[0].text);
      expect(content.data.length).toBe(1);
      expect(content.data[0].id).toBe("institution:test-bank");
      expect(content.data[0].name).toBe("Test Bank");
    });

    it("should return error for non-existent institution", async () => {
      const response = await mcpRequest("tools/call", {
        name: "get_mortgage_rates_by_institution",
        arguments: { institutionId: "institution:nonexistent" },
      });
      const data = await response.json();

      expect(data.result).toBeDefined();
      expect(data.result.isError).toBe(true);
      expect(data.result.content[0].text).toContain("Institution not found");
    });
  });

  describe("get_credit_card_rates", () => {
    it("should retrieve all credit card rates", async () => {
      const response = await mcpRequest("tools/call", {
        name: "get_credit_card_rates",
        arguments: {},
      });
      const data = await response.json();

      expect(data.result).toBeDefined();
      expect(data.result.isError).toBeUndefined();

      const content = JSON.parse(data.result.content[0].text);
      expect(content.type).toBe("CreditCardRates");
      expect(content.data).toBeInstanceOf(Array);
      expect(content.data.length).toBeGreaterThan(0);
    });
  });

  describe("get_credit_card_rates_by_issuer", () => {
    it("should retrieve rates for a specific issuer", async () => {
      const response = await mcpRequest("tools/call", {
        name: "get_credit_card_rates_by_issuer",
        arguments: { issuerId: "issuer:test-bank" },
      });
      const data = await response.json();

      expect(data.result).toBeDefined();
      expect(data.result.isError).toBeUndefined();

      const content = JSON.parse(data.result.content[0].text);
      expect(content.data.length).toBe(1);
      expect(content.data[0].id).toBe("issuer:test-bank");
    });

    it("should return error for non-existent issuer", async () => {
      const response = await mcpRequest("tools/call", {
        name: "get_credit_card_rates_by_issuer",
        arguments: { issuerId: "issuer:nonexistent" },
      });
      const data = await response.json();

      expect(data.result).toBeDefined();
      expect(data.result.isError).toBe(true);
      expect(data.result.content[0].text).toContain("Issuer not found");
    });
  });

  describe("list_available_dates", () => {
    it("should list available dates for mortgage rates", async () => {
      const response = await mcpRequest("tools/call", {
        name: "list_available_dates",
        arguments: { dataType: "mortgage-rates" },
      });
      const data = await response.json();

      expect(data.result).toBeDefined();
      expect(data.result.isError).toBeUndefined();

      const content = JSON.parse(data.result.content[0].text);
      expect(content.dataType).toBe("mortgage-rates");
      expect(content.availableDates).toBeInstanceOf(Array);
      expect(content.availableDates).toContain("2025-01-01");
      expect(content.count).toBeGreaterThan(0);
    });

    it("should list available dates for credit card rates", async () => {
      const response = await mcpRequest("tools/call", {
        name: "list_available_dates",
        arguments: { dataType: "credit-card-rates" },
      });
      const data = await response.json();

      expect(data.result).toBeDefined();
      expect(data.result.isError).toBeUndefined();

      const content = JSON.parse(data.result.content[0].text);
      expect(content.dataType).toBe("credit-card-rates");
      expect(content.availableDates).toContain("2025-01-01");
    });
  });

  describe("get_mortgage_rates_time_series", () => {
    it("should retrieve historical data for a specific date", async () => {
      const response = await mcpRequest("tools/call", {
        name: "get_mortgage_rates_time_series",
        arguments: { date: "2025-01-01" },
      });
      const data = await response.json();

      expect(data.result).toBeDefined();
      expect(data.result.isError).toBeUndefined();

      const content = JSON.parse(data.result.content[0].text);
      expect(content.type).toBe("MortgageRatesTimeSeries");
      expect(content.timeSeries).toHaveProperty("2025-01-01");
      expect(content.availableDates).toContain("2025-01-01");
    });

    it("should return error for non-existent date", async () => {
      const response = await mcpRequest("tools/call", {
        name: "get_mortgage_rates_time_series",
        arguments: { date: "1999-01-01" },
      });
      const data = await response.json();

      expect(data.result).toBeDefined();
      expect(data.result.isError).toBe(true);
      expect(data.result.content[0].text).toContain("No data available for date");
    });

    it("should validate date range", async () => {
      const response = await mcpRequest("tools/call", {
        name: "get_mortgage_rates_time_series",
        arguments: {
          startDate: "2025-03-01",
          endDate: "2025-01-01", // Invalid: end before start
        },
      });
      const data = await response.json();

      expect(data.result).toBeDefined();
      expect(data.result.isError).toBe(true);
      expect(data.result.content[0].text).toContain("Start date cannot be after end date");
    });

    it("should return available dates message when no date specified", async () => {
      const response = await mcpRequest("tools/call", {
        name: "get_mortgage_rates_time_series",
        arguments: {},
      });
      const data = await response.json();

      expect(data.result).toBeDefined();
      expect(data.result.isError).toBeUndefined();

      const content = JSON.parse(data.result.content[0].text);
      expect(content.message).toContain("specify a date");
      expect(content.availableDates).toContain("2025-01-01");
    });
  });
});

describe.skip("MCP Error Handling with Database", () => {

  it("should handle case-insensitive institution lookup", async () => {
    const response = await mcpRequest("tools/call", {
      name: "get_mortgage_rates_by_institution",
      arguments: { institutionId: "INSTITUTION:TEST-BANK" },
    });
    const data = await response.json();

    expect(data.result).toBeDefined();
    expect(data.result.isError).toBeUndefined();

    const content = JSON.parse(data.result.content[0].text);
    expect(content.data[0].id).toBe("institution:test-bank");
  });

  it("should handle case-insensitive issuer lookup", async () => {
    const response = await mcpRequest("tools/call", {
      name: "get_credit_card_rates_by_issuer",
      arguments: { issuerId: "ISSUER:TEST-BANK" },
    });
    const data = await response.json();

    expect(data.result).toBeDefined();
    expect(data.result.isError).toBeUndefined();

    const content = JSON.parse(data.result.content[0].text);
    expect(content.data[0].id).toBe("issuer:test-bank");
  });
});
