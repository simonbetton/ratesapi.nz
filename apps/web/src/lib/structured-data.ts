import type { KeyFacts } from "./key-facts";

// Search engines read these as they are, so they always use the production
// URLs, even in local development.
const origin = "https://www.ratesapi.nz";
const home = `${origin}/`;
const repository = "https://github.com/simonbetton/ratesapi.nz";
const ids = {
  publisher: `${origin}/#publisher`,
  website: `${origin}/#website`,
  api: `${origin}/#api`,
  source: `${origin}/#source`,
  dataset: `${origin}/#dataset`,
};

const distributions = [
  ["Mortgage rates", "mortgage-rates"],
  ["Personal loan rates", "personal-loan-rates"],
  ["Car loan rates", "car-loan-rates"],
  ["Credit card rates", "credit-card-rates"],
] as const;

function dataset(facts: KeyFacts | null) {
  return {
    "@type": "Dataset",
    "@id": ids.dataset,
    name: "New Zealand lending interest rates",
    description:
      "New Zealand mortgage, personal loan, car loan and credit card interest rates from 30+ lenders and card issuers, collected hourly from interest.co.nz and served as free JSON by Rates API, with a daily history.",
    url: home,
    creator: { "@id": ids.publisher },
    publisher: { "@id": ids.publisher },
    // No `license`: the MIT licence covers the code, not the rates. The rates
    // come from interest.co.nz, and the about page explains how to use them.
    isBasedOn: {
      "@type": "WebSite",
      name: "interest.co.nz",
      url: "https://www.interest.co.nz/",
    },
    usageInfo: `${origin}/docs/about#data-source-and-licence`,
    creditText: "Rates data from interest.co.nz, collected by Rates API.",
    isAccessibleForFree: true,
    // Without live facts, leave the dates out rather than guess them.
    ...(facts && {
      temporalCoverage: `${facts.historyStart}/..`,
      dateModified: facts.lastUpdated,
    }),
    spatialCoverage: {
      "@type": "Place",
      name: "New Zealand",
      address: { "@type": "PostalAddress", addressCountry: "NZ" },
    },
    variableMeasured: [
      "Mortgage interest rates",
      "Personal loan interest rates",
      "Car loan interest rates",
      "Credit card interest rates",
    ],
    distribution: distributions.map(([name, path]) => ({
      "@type": "DataDownload",
      name: `${name} (JSON)`,
      encodingFormat: "application/json",
      contentUrl: `${origin}/api/v1/${path}`,
    })),
    includedInDataCatalog: {
      "@type": "DataCatalog",
      name: "Rates API",
      url: home,
    },
  };
}

/** The homepage's JSON-LD: publisher, site, API, source code and dataset. */
export function homepageStructuredData(facts: KeyFacts | null) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": ids.publisher,
        name: "Simon Betton",
        url: "https://www.simonbetton.com",
        sameAs: ["https://github.com/simonbetton"],
      },
      {
        "@type": "WebSite",
        "@id": ids.website,
        url: home,
        name: "Rates API",
        description:
          "Free, open-source JSON API for New Zealand mortgage, personal loan, car loan and credit card interest rates, updated hourly from interest.co.nz.",
        publisher: { "@id": ids.publisher },
        inLanguage: "en-NZ",
      },
      {
        "@type": ["SoftwareApplication", "WebAPI"],
        "@id": ids.api,
        name: "Rates API",
        alternateName: "ratesapi.nz",
        description:
          "Free, open-source JSON API for New Zealand mortgage, personal loan, car loan and credit card interest rates. No account or API key required. Includes an MCP server and an OpenAPI specification for AI agents.",
        url: home,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Any",
        documentation: `${origin}/docs`,
        discussionUrl: `${repository}/issues`,
        // The code is MIT licensed; the dataset below carries no licence.
        license: `${repository}/blob/main/LICENSE`,
        provider: { "@id": ids.publisher },
        creator: { "@id": ids.publisher },
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "NZD" },
      },
      {
        "@type": "SoftwareSourceCode",
        "@id": ids.source,
        name: "Rates API source code",
        codeRepository: repository,
        programmingLanguage: "TypeScript",
        license: `${repository}/blob/main/LICENSE`,
        author: { "@id": ids.publisher },
        targetProduct: { "@id": ids.api },
      },
      dataset(facts),
    ],
  };
}

/**
 * Serialises JSON-LD for an inline script. `<` is escaped so no string in the
 * data can close the script element early.
 */
export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replaceAll("<", String.raw`\u003c`);
}
