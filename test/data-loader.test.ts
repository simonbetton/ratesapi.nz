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

  test("only enables production latest-data fallback for development", () => {
    expect(
      productionLatestDataFallbackUrl("personal-loan-rates", "development"),
    ).toBe("https://ratesapi.nz/api/v1/personal-loan-rates");
    expect(
      productionLatestDataFallbackUrl("personal-loan-rates", "production"),
    ).toBeUndefined();
  });
});
