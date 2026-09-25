import { apiUrl, docsUrl } from "../lib/site-urls";

const openApiUrl = apiUrl("/openapi");

export const apiLinks = {
  openapi: openApiUrl,
  openapiJson: apiUrl("/openapi/json"),
  mortgageRatesOpenApi: `${openApiUrl}#tag/mortgage-rates`,
  mortgageTimeSeriesOpenApi: `${openApiUrl}#tag/mortgage-rates/GET/api/v1/mortgage-rates/time-series`,
  personalLoanRatesOpenApi: `${openApiUrl}#tag/personal-loan-rates`,
  carLoanRatesOpenApi: `${openApiUrl}#tag/car-loan-rates`,
  creditCardRatesOpenApi: `${openApiUrl}#tag/credit-card-rates`,
  concepts: docsUrl("/api-reference/concepts"),
  llmsTxt: docsUrl("/llms.txt"),
  mcpDocs: docsUrl("/api-reference/ai-integration"),
  source: "https://github.com/simonbetton/ratesapi.nz",
  openSource: docsUrl("/open-source"),
  localDevelopment: docsUrl("/open-source/local-development"),
  deployment: docsUrl("/open-source/deployment"),
  health: apiUrl("/api/v1/health"),
  author: "https://www.simonbetton.com",
} as const;

export const endpointCards = [
  {
    title: "Mortgage rates",
    body: "Fixed and floating rates, grouped by institution and product. Filter by mortgage term.",
    path: "/api/v1/mortgage-rates",
    href: `${openApiUrl}#tag/mortgage-rates/GET/api/v1/mortgage-rates`,
  },
  {
    title: "Personal loan rates",
    body: "Secured and unsecured lending products, with rate conditions alongside each offer.",
    path: "/api/v1/personal-loan-rates",
    href: `${openApiUrl}#tag/personal-loan-rates/GET/api/v1/personal-loan-rates`,
  },
  {
    title: "Car loan rates",
    body: "Vehicle finance rates and conditions, organised by institution and product.",
    path: "/api/v1/car-loan-rates",
    href: `${openApiUrl}#tag/car-loan-rates/GET/api/v1/car-loan-rates`,
  },
  {
    title: "Credit card rates",
    body: "Purchase rates, cash advances, fees, and balance transfer offers, grouped by issuer.",
    path: "/api/v1/credit-card-rates",
    href: `${openApiUrl}#tag/credit-card-rates/GET/api/v1/credit-card-rates`,
  },
] as const;

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
  ["Collect", "Read interest.co.nz"],
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
