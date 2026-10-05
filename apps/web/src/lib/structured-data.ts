import type { KeyFacts } from "./key-facts";
import type { ContentPage } from "./page-content";

// Search engines read these as they are, so they always use the production
// URLs, even in local development.
const origin = "https://www.ratesapi.nz";
const home = `${origin}/`;
const repository = "https://github.com/simonbetton/ratesapi.nz";
const ids = {
  publisher: `${origin}/#publisher`,
  organization: `${origin}/#organization`,
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
      "New Zealand mortgage, personal loan, car loan and credit card interest rates from New Zealand lenders and card issuers, collected directly from institution websites on an hourly schedule and served as free JSON by Rates API, with a daily history.",
    url: home,
    creator: { "@id": ids.publisher },
    publisher: { "@id": ids.publisher },
    // No `license`: the MIT licence covers the code, not the rates.
    // Direct collections use institution websites.
    usageInfo: `${origin}/docs/about#data-source-and-licence`,
    creditText:
      "Direct rates from institution websites, collected by Rates API.",
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

// The project as an organization, with the page to contact it. Every page
// with JSON-LD repeats this node with the same @id.
function organization() {
  return {
    "@type": "Organization",
    "@id": ids.organization,
    name: "Rates API",
    alternateName: "ratesapi.nz",
    url: home,
    description:
      "Rates API runs a free, open-source JSON API for New Zealand mortgage, personal loan, car loan and credit card interest rates.",
    logo: {
      "@type": "ImageObject",
      url: `${origin}/icon-512.png`,
      width: 512,
      height: 512,
    },
    founder: { "@id": ids.publisher },
    sameAs: [repository],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: `${origin}/contact`,
      availableLanguage: "en",
      areaServed: "NZ",
    },
  };
}

const person = {
  "@type": "Person",
  "@id": ids.publisher,
  name: "Simon Betton",
  url: "https://www.simonbetton.com",
  sameAs: ["https://github.com/simonbetton"],
};

/** The homepage's JSON-LD: publisher, site, API, source code and dataset. */
export function homepageStructuredData(facts: KeyFacts | null) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      person,
      organization(),
      {
        "@type": "WebSite",
        "@id": ids.website,
        url: home,
        name: "Rates API",
        description:
          "Free, open-source JSON API for New Zealand mortgage, personal loan, car loan and credit card interest rates, collected directly from institution websites on an hourly schedule.",
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

/** The JSON-LD of a text page (about, contact, privacy). */
export function contentPageStructuredData(page: ContentPage) {
  const url = `${origin}${page.path}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": page.schemaType,
        "@id": `${url}#webpage`,
        url,
        name: page.title,
        description: page.description,
        inLanguage: "en-NZ",
        isPartOf: { "@id": ids.website },
        about: { "@id": ids.organization },
        ...(page.updated && { dateModified: page.updated }),
      },
      organization(),
      {
        "@type": "WebSite",
        "@id": ids.website,
        url: home,
        name: "Rates API",
        publisher: { "@id": ids.publisher },
      },
      person,
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
