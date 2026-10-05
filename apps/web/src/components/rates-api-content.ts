import type { Inline } from "../lib/page-content";
import { apiUrl, docsUrl } from "../lib/site-urls";

const openApiUrl = apiUrl("/openapi");

// The homepage's <title> and descriptions. The Markdown homepage uses them too.
export const homepageMeta = {
  title: "Free NZ Mortgage & Interest Rates API (JSON) | Rates API",
  description:
    "Free JSON API for NZ mortgage, personal loan, car loan and credit card interest rates from New Zealand lenders. Updated hourly, with daily history. No API key.",
  socialDescription:
    "Latest and historical NZ lending rates for products, dashboards, and agent tools.",
} as const;

export const apiLinks = {
  openapi: openApiUrl,
  openapiJson: apiUrl("/openapi.json"),
  mortgageRatesOpenApi: `${openApiUrl}#tag/mortgage-rates`,
  mortgageTimeSeriesOpenApi: `${openApiUrl}#tag/mortgage-rates/GET/api/v1/mortgage-rates/time-series`,
  personalLoanRatesOpenApi: `${openApiUrl}#tag/personal-loan-rates`,
  carLoanRatesOpenApi: `${openApiUrl}#tag/car-loan-rates`,
  creditCardRatesOpenApi: `${openApiUrl}#tag/credit-card-rates`,
  docs: docsUrl(""),
  quickstart: docsUrl("/api-reference/quickstart"),
  about: docsUrl("/about"),
  aboutData: docsUrl("/about#data-source-and-licence"),
  concepts: docsUrl("/api-reference/concepts"),
  llmsTxt: docsUrl("/llms.txt"),
  mcpDocs: docsUrl("/api-reference/ai-integration"),
  source: "https://github.com/simonbetton/ratesapi.nz",
  openSource: docsUrl("/open-source"),
  localDevelopment: docsUrl("/open-source/local-development"),
  deployment: docsUrl("/open-source/deployment"),
  monitoring: docsUrl("/open-source/monitoring"),
  health: apiUrl("/api/v1/health"),
  author: "https://www.simonbetton.com",
} as const;

export const heroContent = {
  eyebrow: "New Zealand lending data",
  title: "Build the product.",
  titleEnd: "We’ll bring the rates.",
  description:
    "Add New Zealand mortgage, loan, and credit card rates to your app with one free JSON API. Build comparisons, calculators, and agents without maintaining your own scrapers.",
  proof: ["Free to use", "No API key", "Open source · MIT"],
} as const;

export const endpointCards = [
  {
    title: "Mortgage rates",
    body: "Fixed and floating rates, grouped by institution and product. Filter by mortgage term.",
    path: "/api/v1/mortgage-rates",
    href: `${openApiUrl}#tag/mortgage-rates/GET/api/v1/mortgage-rates`,
    idParameter: "institutionId",
  },
  {
    title: "Personal loan rates",
    body: "Secured and unsecured lending products, with rate conditions alongside each offer.",
    path: "/api/v1/personal-loan-rates",
    href: `${openApiUrl}#tag/personal-loan-rates/GET/api/v1/personal-loan-rates`,
    idParameter: "institutionId",
  },
  {
    title: "Car loan rates",
    body: "Vehicle finance rates and conditions, organised by institution and product.",
    path: "/api/v1/car-loan-rates",
    href: `${openApiUrl}#tag/car-loan-rates/GET/api/v1/car-loan-rates`,
    idParameter: "institutionId",
  },
  {
    title: "Credit card rates",
    body: "Purchase rates, cash advances, fees, and balance transfer offers, grouped by issuer.",
    path: "/api/v1/credit-card-rates",
    href: `${openApiUrl}#tag/credit-card-rates/GET/api/v1/credit-card-rates`,
    idParameter: "issuerId",
  },
] as const;

// "A few useful details" on the homepage.
export const integrationNotes: { question: string; answer: Inline[] }[] = [
  {
    question: "Is the hosted API free?",
    answer: [
      "Yes. Public endpoints need no account, API key, or payment details. The source code is MIT licensed, so you can also run your own instance.",
    ],
  },
  {
    question: "Where do the rates come from?",
    answer: [
      "Direct collections use institution websites and include a sourceUrl. Older snapshots came from interest.co.nz. Collection is scheduled hourly, but freshness varies by dataset. Check ",
      { code: "lastUpdated" },
      " and confirm rates and eligibility with the provider before relying on an offer. ",
      {
        text: "Read about the data source and its limits.",
        href: apiLinks.aboutData,
      },
    ],
  },
  {
    question: "Can I call it from a browser?",
    answer: [
      "Yes. Public API routes allow cross-origin requests without credentials. Use native ",
      { code: "fetch" },
      " or any HTTP client. Check HTTP status codes, handle unavailable data, and cache responses where appropriate.",
    ],
  },
  {
    question: "How do I query historical rates?",
    answer: [
      "Add ",
      { code: "/time-series" },
      " to a category route. Use ",
      { code: "date" },
      " for one day, or ",
      { code: "startDate" },
      " and ",
      { code: "endDate" },
      " together for a range. Responses include ",
      { code: "availableDates" },
      "; coverage depends on stored snapshots. ",
      {
        text: "See a mortgage history example.",
        href: apiLinks.mortgageTimeSeriesOpenApi,
      },
    ],
  },
];

export const rateTableRows = [
  ["Special", "6 months", "4.49%"],
  ["Special", "1 year", "4.69%"],
  ["Standard", "2 years", "5.89%"],
  ["Good Energy", "3 years", "1.00%"],
] as const;

export const rateTrendBars = [
  "h-[52%]",
  "h-[70%]",
  "h-[62%]",
  "h-[82%]",
  "h-[76%]",
  "h-[64%]",
  "h-[58%]",
  "h-[69%]",
  "h-[60%]",
] as const;

export const collectionSteps = [
  ["Collect", "Read institution websites"],
  ["Normalise", "Group providers and products"],
  ["Store", "Save latest rows and history"],
  ["Serve", "Return JSON from the edge"],
] as const;

export const terminalFlowSteps = [
  { kind: "command", text: "bun i" },
  { kind: "output", text: "dependencies installed" },

  { kind: "command", text: "bun run dev" },
  { kind: "output", text: "worker ready on localhost:8787" },
  { kind: "command", text: "curl localhost:8787/api/v1/mortgage-rates" },
  { kind: "output", text: "200 OK  |  latest mortgage rows returned" },
] as const;

export const techBadges = [
  "MIT",
  "TypeScript",
  "Workers",
  "D1",
  "OpenAPI",
] as const;
