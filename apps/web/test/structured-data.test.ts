import { describe, expect, test } from "bun:test";

import { aboutPage } from "../src/content/about";
import { contactPage } from "../src/content/contact";
import { privacyPage } from "../src/content/privacy";
import type { KeyFacts } from "../src/lib/key-facts";
import {
  contentPageStructuredData,
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

interface Graph {
  "@graph": unknown[];
}

function nodes(data: Graph) {
  return data["@graph"] as Node[];
}

function nodeOfType(data: Graph, type: string) {
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
      "https://www.ratesapi.nz/#organization",
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

  test("describes direct provenance without licensing the rate data", () => {
    const dataset = nodeOfType(homepageStructuredData(facts), "Dataset");
    expect(dataset.license).toBeUndefined();
    expect(dataset.isBasedOn).toBeUndefined();
    expect(dataset.creditText).toContain("institution websites");
    expect(dataset.usageInfo).toBe(
      "https://www.ratesapi.nz/docs/about#data-source-and-licence"
    );
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

  test("describes the organization with its founder and a contact point", () => {
    const organization = nodeOfType(
      homepageStructuredData(facts),
      "Organization"
    );
    expect(organization).toMatchObject({
      name: "Rates API",
      url: "https://www.ratesapi.nz/",
      founder: { "@id": "https://www.ratesapi.nz/#publisher" },
      sameAs: ["https://github.com/simonbetton/ratesapi.nz"],
      logo: { url: "https://www.ratesapi.nz/icon-512.png" },
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        url: "https://www.ratesapi.nz/contact",
      },
    });
  });
});

describe("text page JSON-LD", () => {
  test.each([
    [aboutPage, "AboutPage"],
    [contactPage, "ContactPage"],
    [privacyPage, "WebPage"],
  ] as const)("describes %p as a page about the organization", (page, type) => {
    const data = contentPageStructuredData(page);
    const node = nodeOfType(data, type);
    const url = `https://www.ratesapi.nz${page.path}`;

    expect(node).toMatchObject({
      "@id": `${url}#webpage`,
      url,
      name: page.title,
      description: page.description,
      isPartOf: { "@id": "https://www.ratesapi.nz/#website" },
      about: { "@id": "https://www.ratesapi.nz/#organization" },
    });
    // The page is complete alone: every reference has its node.
    const ids = new Set(nodes(data).map((item) => item["@id"]));
    for (const match of JSON.stringify(data).matchAll(
      /\{"@id":"(?<id>[^"]+)"\}/gu
    )) {
      expect(ids.has(match.groups?.id)).toBe(true);
    }
    expect(nodeOfType(data, "Organization")).toEqual(
      nodeOfType(homepageStructuredData(facts), "Organization")
    );
  });

  test("dates the privacy notice from its last update", () => {
    const node = nodeOfType(contentPageStructuredData(privacyPage), "WebPage");
    expect(node.dateModified).toBe(privacyPage.updated);
    expect(
      nodeOfType(contentPageStructuredData(aboutPage), "AboutPage")
    ).not.toHaveProperty("dateModified");
  });
});
