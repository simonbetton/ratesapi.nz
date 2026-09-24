import { describe, expect, test } from "bun:test";

import {
  fromSavableJson,
  productionLatestDataFallbackUrl,
  toSavableJson,
} from "../apps/api/src/lib/data-loader";

describe("data-loader serialization", () => {
  test("round-trips savable JSON without changing the object shape", () => {
    const value = {
      type: "MortgageRates",
      data: [
        {
          id: "institution:anz",
          products: [{ id: "product:anz:standard", rates: [] }],
        },
      ],
      lastUpdated: "2026-04-30T00:00:00.000Z",
    };

    expect(fromSavableJson(toSavableJson(value))).toEqual(value);
  });

  test("round-trips Unicode characters like macrons, curly punctuation, and emoji", () => {
    const value = {
      type: "MortgageRates",
      data: [
        {
          id: "institution:kiwibank",
          name: "Kāinga Ora — “preferred” rate 🏠",
          products: [{ id: "product:kiwibank:standard", rates: [] }],
        },
      ],
      lastUpdated: "2026-04-30T00:00:00.000Z",
    };

    expect(fromSavableJson(toSavableJson(value))).toEqual(value);

    const decoded = atob(toSavableJson(value));

    expect(decoded).toContain("\\u0101");
    expect(/[\u0080-\uffff]/.test(decoded)).toBe(false);
  });

  test("still decodes legacy base64 blobs produced by the old btoa(JSON.stringify(value)) formula", () => {
    const value = {
      type: "MortgageRates",
      data: [
        {
          id: "institution:anz",
          name: "Café ANZ",
          products: [{ id: "product:anz:standard", rates: [] }],
        },
      ],
      lastUpdated: "2026-04-30T00:00:00.000Z",
    };

    const legacyBlob = btoa(JSON.stringify(value));

    expect(fromSavableJson(legacyBlob)).toEqual(value);
  });

  test("only enables production latest-data fallback for development", () => {
    expect(
      productionLatestDataFallbackUrl("personal-loan-rates", "development")
    ).toBe("https://ratesapi.nz/api/v1/personal-loan-rates");
    expect(
      productionLatestDataFallbackUrl("personal-loan-rates", "production")
    ).toBeUndefined();
  });
});
