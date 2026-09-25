export type ApiGlyphType = "code" | "chart" | "clock" | "db";

export type EndpointIconName =
  | "home"
  | "wallet"
  | "car"
  | "card"
  | "chart"
  | "schema"
  | "spark";

const openApiUrl = "https://ratesapi.nz/openapi";

export const apiLinks = {
  sampleRequest: "https://ratesapi.nz/api/v1/mortgage-rates",
  openapi: openApiUrl,
  openapiJson: "https://ratesapi.nz/openapi/json",
  mortgageRatesOpenApi: `${openApiUrl}#tag/mortgage-rates`,
  personalLoanRatesOpenApi: `${openApiUrl}#tag/personal-loan-rates`,
  carLoanRatesOpenApi: `${openApiUrl}#tag/car-loan-rates`,
  creditCardRatesOpenApi: `${openApiUrl}#tag/credit-card-rates`,
  mcpDocs: "https://ratesapi.nz/api-reference/ai-integration",
  source: "https://github.com/simonbetton/ratesapi.nz",
  openSource: "https://ratesapi.nz/open-source",
  localDevelopment: "https://ratesapi.nz/open-source/local-development",
  deployment: "https://ratesapi.nz/open-source/deployment",
  health: "https://ratesapi.nz/api/v1/health",
} as const;

export const endpointCards = [
  {
    title: "Mortgage rates",
    body: "Fixed and floating rates, grouped by institution and product. Filter by mortgage term.",
    path: "/api/v1/mortgage-rates",
    href: "https://ratesapi.nz/api-reference/endpoint/mortgage-rates/list",
  },
  {
    title: "Personal loan rates",
    body: "Secured and unsecured lending products, with rate conditions alongside each offer.",
    path: "/api/v1/personal-loan-rates",
    href: "https://ratesapi.nz/api-reference/endpoint/personal-loan-rates/list",
  },
  {
    title: "Car loan rates",
    body: "Vehicle finance rates and conditions, organised by institution and product.",
    path: "/api/v1/car-loan-rates",
    href: "https://ratesapi.nz/api-reference/endpoint/car-loan-rates/list",
  },
  {
    title: "Credit card rates",
    body: "Purchase rates, cash advances, fees, and balance transfer offers, grouped by issuer.",
    path: "/api/v1/credit-card-rates",
    href: "https://ratesapi.nz/api-reference/endpoint/credit-card-rates/list",
  },
] as const;

export const productRows = [
  [
    "Mortgage rates",
    "GET /api/v1/mortgage-rates",
    "List, by institution, time series",
  ],
  [
    "Personal loan rates",
    "GET /api/v1/personal-loan-rates",
    "List, by institution, time series",
  ],
  [
    "Car loan rates",
    "GET /api/v1/car-loan-rates",
    "List, by institution, time series",
  ],
  [
    "Credit card rates",
    "GET /api/v1/credit-card-rates",
    "List, by issuer, time series",
  ],
] as const;

export const aiCapabilities = [
  {
    title: "MCP endpoint",
    copy: "Agents can discover tools/list and call tools such as list_mortgage_rates.",
    href: apiLinks.mcpDocs,
    icon: "db",
  },
  {
    title: "OpenAPI JSON",
    copy: "Generate clients or tool schemas from the contract behind the docs.",
    href: apiLinks.openapiJson,
    icon: "code",
  },
  {
    title: "Stable identifiers",
    copy: "Carry institution, issuer, product, and rate IDs through follow-up calls.",
    href: apiLinks.mortgageRatesOpenApi,
    icon: "chart",
  },
  {
    title: "Public reads",
    copy: "Let prototypes call public endpoints before you add accounts or secrets.",
    href: apiLinks.sampleRequest,
    icon: "code",
  },
] satisfies readonly {
  title: string;
  copy: string;
  href: string;
  icon: ApiGlyphType;
}[];

export const openApiCards = [
  {
    title: "Scalar UI",
    copy: "Try requests in the browser without writing a curl command first.",
  },
  {
    title: "Raw contract",
    copy: "Use /openapi/json for generated clients, validation, and tool schemas.",
  },
  {
    title: "Grouped endpoints",
    copy: "Browse mortgage, personal loan, car loan, and credit card routes by tag.",
  },
  {
    title: "Live examples",
    copy: "Check path parameters, query filters, and response models in one view.",
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

export const infrastructureCards = [
  {
    name: "Cloudflare",
    detail: "Workers edge runtime",
    metric: "Edge hosted",
    copy: "API routes run on Cloudflare Workers, keeping response paths short for public reads.",
    tone: "cloudflare",
  },
  {
    name: "Scalar",
    detail: "Interactive OpenAPI docs",
    metric: "/openapi",
    copy: "Scalar renders the generated OpenAPI spec for browser-based request testing.",
    tone: "scalar",
  },
  {
    name: "GitHub",
    detail: "MIT source",
    metric: "Open repo",
    copy: "Scrapers, routes, schema, deployment notes, and monitoring checks live in GitHub.",
    tone: "github",
  },
] as const;

export const endpointPatternFamilies = [
  "mortgage-rates",
  "personal-loan-rates",
  "car-loan-rates",
  "credit-card-rates",
] as const;

export const endpointPatternRows = [
  {
    step: "01",
    title: "Latest by family",
    endpoint: "GET /api/v1/mortgage-rates",
    detail:
      "Start with a product family. The response groups products under each provider.",
  },
  {
    step: "02",
    title: "One provider",
    endpoint: "GET /api/v1/mortgage-rates/institution:anz",
    detail: "Pass the provider ID when the UI drills into one bank or issuer.",
  },
  {
    step: "03",
    title: "Historical series",
    endpoint: "GET /api/v1/mortgage-rates/time-series",
    detail:
      "Add date filters for trend lines, audits, and point-in-time comparisons.",
  },
] as const;

export const techBadges = [
  "MIT",
  "TypeScript",
  "Workers",
  "D1",
  "OpenAPI",
] as const;

export const integrationCards = [
  {
    title: "Frontend apps",
    copy: "Next.js, React, static sites",
    icon: "code",
  },
  {
    title: "Backend services",
    copy: "Node, Bun, Python, Ruby",
    icon: "code",
  },
  {
    title: "AI agents",
    copy: "MCP and OpenAPI",
    icon: "code",
  },
  {
    title: "Data work",
    copy: "Dashboards, notebooks, CSV exports",
    icon: "code",
  },
  {
    title: "Calculators",
    copy: "Affordability and repayment tools",
    icon: "code",
  },
  {
    title: "Market alerts",
    copy: "Rate movement monitors",
    icon: "clock",
  },
  {
    title: "Research",
    copy: "Historical analysis and reports",
    icon: "chart",
  },
  {
    title: "Open source",
    copy: "Fork and deploy on Workers",
    icon: "code",
  },
] satisfies readonly {
  title: string;
  copy: string;
  icon: ApiGlyphType;
}[];

export const useCaseExamples = [
  {
    mode: "Comparison",
    title: "Comparison table",
    badge: "live",
    description: "Latest 1-year special mortgage rates",
    rows: [
      ["ANZ", "1 year", "4.69%"],
      ["BNZ", "1 year", "4.75%"],
      ["ASB", "1 year", "4.79%"],
    ],
    resultTitle: "Sorted lender view",
    resultLines: [
      "GET /api/v1/mortgage-rates?termInMonths=12",
      "Group by institution ID",
      "Render the latest products",
    ],
  },
  {
    mode: "Calculator",
    title: "Repayment input",
    badge: "term",
    description: "Pull a rate into repayment maths",
    rows: [
      ["Loan", "$680,000", "principal"],
      ["Term", "30 years", "input"],
      ["Rate", "4.69%", "from API"],
    ],
    resultTitle: "Calculator output",
    resultLines: [
      "Monthly payment: $3,523",
      "Source rate: product:anz:special",
      "Refresh when collection updates",
    ],
  },
  {
    mode: "Dashboard",
    title: "Market dashboard",
    badge: "trend",
    description: "Track movement across lender groups",
    rows: [
      ["Major banks", "4.69-4.89%", "1 year"],
      ["Floating", "6.79-8.64%", "range"],
      ["Updated", "hourly", "health"],
    ],
    resultTitle: "Dashboard widgets",
    resultLines: [
      "Compare rate bands by term",
      "Flag changed rows since yesterday",
      "Link each row back to provider ID",
    ],
  },
  {
    mode: "Agent",
    title: "MCP tool call",
    badge: "tool",
    description: "Use the real MCP tool names",
    rows: [
      ["method", "tools/call", "MCP"],
      ["name", "list_mortgage_rates", "tool"],
      ["term", "12", "argument"],
    ],
    resultTitle: "Assistant answer",
    resultLines: [
      "Lowest 1-year special: ANZ 4.69%",
      "Next: BNZ 4.75%, ASB 4.79%",
      "Source: ratesapi.nz MCP",
    ],
  },
  {
    mode: "Research",
    title: "Historical query",
    badge: "archive",
    description: "Ask what changed over a date range",
    rows: [
      ["startDate", "2026-01-01", "query"],
      ["endDate", "2026-05-29", "query"],
      ["institution", "institution:anz", "filter"],
    ],
    resultTitle: "Research notes",
    resultLines: [
      "Export snapshots into a notebook",
      "Chart one provider or market range",
      "Keep old labels tied to stable IDs",
    ],
  },
  {
    mode: "Monitoring",
    title: "Rate alert",
    badge: "watch",
    description: "Watch the latest endpoint for changes",
    rows: [
      ["Check", "hourly", "schedule"],
      ["Filter", "termInMonths=12", "query"],
      ["Trigger", "rate changed", "alert"],
    ],
    resultTitle: "Alert payload",
    resultLines: [
      "ANZ 1-year special changed",
      "Previous: 4.79%",
      "Current: 4.69%",
    ],
  },
] as const;
