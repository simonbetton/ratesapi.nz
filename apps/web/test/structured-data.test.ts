import { describe, expect, test } from "bun:test";

import type { KeyFacts } from "../src/lib/key-facts";
import {
  homepageStructuredData,
  jsonLdScript,
} from "../src/lib/structured-data";

const facts: KeyFacts = {
  mortgageLenders: 36,
  personalLoanLenders: 39,
  carLoanLenders: 32,
  creditCardIssuers: 33,
  lastUpdated: "2026-09-25T07:57:32.965Z",
  historyStart: "2025-03-08",
};

type Node = Record<string, unknown>;

function nodes(data: ReturnType<typeof homepageStructuredData>) {
  return data["@graph"] as Node[];
}

function nodeOfType(
  data: ReturnType<typeof homepageStructuredData>,
  type: string
) {
  const node = nodes(data).find((item) =>
    [item["@type"]].flat().includes(type)
  );
  if (!node) {
    throw new Error(`No ${type} node`);
  }
  return node;
}

describe("homepage JSON-LD", () => {
  test("links every node by a stable @id", () => {
    const data = homepageStructuredData(facts);
    expect(data["@context"]).toBe("https://schema.org");
    expect(nodes(data).map((node) => node["@id"])).toEqual([
      "https://www.ratesapi.nz/#publisher",
      "https://www.ratesapi.nz/#website",
      "https://www.ratesapi.nz/#api",
      "https://www.ratesapi.nz/#source",
      "https://www.ratesapi.nz/#dataset",
    ]);
    const ids = new Set(nodes(data).map((node) => node["@id"]));
    // Every { "@id" } reference points at a node in the graph.
    const references = [
      ...JSON.stringify(data).matchAll(/\{"@id":"(?<id>[^"]+)"\}/gu),
    ].map((match) => match.groups?.id);
    expect(references.length).toBeGreaterThan(0);
    for (const id of references) {
      expect(ids.has(id)).toBe(true);
    }
  });

  test("credits interest.co.nz for the data instead of licensing it", () => {
    const dataset = nodeOfType(homepageStructuredData(facts), "Dataset");
    expect(dataset.license).toBeUndefined();
    expect(dataset.isBasedOn).toEqual({
      "@type": "WebSite",
      name: "interest.co.nz",
      url: "https://www.interest.co.nz/",
    });
    expect(dataset.usageInfo).toBe(
      "https://www.ratesapi.nz/docs/about#data-source-and-licence"
    );
    expect(dataset.creditText).toContain("interest.co.nz");
    // The MIT licence stays on the code.
    const api = nodeOfType(homepageStructuredData(facts), "WebAPI");
    expect(api.license).toBe(
      "https://github.com/simonbetton/ratesapi.nz/blob/main/LICENSE"
    );
  });

  test("dates the dataset from live facts, and omits dates without them", () => {
    const live = nodeOfType(homepageStructuredData(facts), "Dataset");
    expect(live.dateModified).toBe("2026-09-25T07:57:32.965Z");
    expect(live.temporalCoverage).toBe("2025-03-08/..");

    const fallback = nodeOfType(homepageStructuredData(null), "Dataset");
    expect(fallback).not.toHaveProperty("dateModified");
    expect(fallback).not.toHaveProperty("temporalCoverage");
  });

  test("serialises to JSON that can't close its script element", () => {
    const script = jsonLdScript({ name: "</script><script>alert(1)</script>" });
    expect(script).not.toContain("<");
    expect(JSON.parse(script)).toEqual({
      name: "</script><script>alert(1)</script>",
    });
    expect(JSON.parse(jsonLdScript(homepageStructuredData(facts)))).toEqual(
      homepageStructuredData(facts)
    );
  });
});
