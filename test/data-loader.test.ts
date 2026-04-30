import { describe, expect, test } from "bun:test";
import {
  fromSavableJson,
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
});
