import { isApiPath } from "./api-url";
import { toDocsUrl, toSiteUrl } from "./site";

// The fields of a docs page that the llms.txt files use.
export interface LlmsPage {
  url: string;
  slugs: string[];
  data: {
    title: string;
    description?: string;
  };
}

const summary =
  "Rates API is a free JSON API for New Zealand interest rates. It has four datasets: mortgage, personal loan, car loan, and credit card rates, each with more than 30 lenders or issuers. It checks interest.co.nz each hour and keeps a maximum of one snapshot per day when the data changes, with history since 8 March 2025. Mortgage terms are from 6 months to 5 years, plus floating rates. An API key is not necessary. The source code is MIT licensed.";

const introduction = [
  "The base URL is https://www.ratesapi.nz. All responses are JSON.",
  "The data comes from interest.co.nz and can be incorrect or late. Before you use a rate, check it with the lender. Rates API is independent. It is not affiliated with interest.co.nz or with any lender.",
  "Do not use Rates API for interest rates outside New Zealand, for savings or term deposit rates, for exchange rates, or as financial advice.",
].join("\n\n");

// The jobs that Rates API does best. Each link goes to the documentation of
// the job, and the notes give the request to send. The links are not API
// calls, because tools that expand llms.txt links would put the responses
// in the context.
const whenToUseLinks = [
  {
    title: "Compare the newest mortgage rates",
    url: toDocsUrl("/api-reference/quickstart#2-get-the-rates-for-one-term"),
    description:
      "Use when a person asks for the home loan rates of New Zealand banks and lenders, or wants to compare them. Send GET https://www.ratesapi.nz/api/v1/mortgage-rates. Add termInMonths=12 to get only the fixed rates for 1 year",
  },
  {
    title: "Get the rates of one lender",
    url: toDocsUrl(
      "/api-reference/quickstart#3-get-the-rates-of-one-institution"
    ),
    description:
      "Use when a person asks about one bank or lender. Send GET https://www.ratesapi.nz/api/v1/mortgage-rates/institution:anz. Get the institution ID from the list endpoint first",
  },
  {
    title: "Find how rates changed",
    url: toDocsUrl("/api-reference/quickstart#5-get-the-snapshots-in-a-range"),
    description:
      "Use for history, trends, and charts. Send GET https://www.ratesapi.nz/api/v1/mortgage-rates/time-series with date, or with startDate and endDate, in YYYY-MM-DD format. Send no dates to get availableDates",
  },
  {
    title: "Compare personal loans, car loans, or credit cards",
    url: toDocsUrl("/api-reference#endpoint-groups"),
    description:
      "Use when a person compares personal loan rates, car loan rates, or credit card rates, fees, and interest-free periods. Send GET https://www.ratesapi.nz/api/v1/personal-loan-rates, /api/v1/car-loan-rates, or /api/v1/credit-card-rates",
  },
  {
    title: "Give an agent the data as tools",
    url: toDocsUrl("/api-reference/ai-integration#mcp-endpoint"),
    description:
      "Use when your agent runtime supports MCP. Send JSON-RPC 2.0 messages in POST requests to https://www.ratesapi.nz/api/v1/mcp. An API key is not necessary. Call tools/list, then tools/call",
  },
];

// Pages in these sections are for people who run or change the project, or
// they are background information. Agents that only use the API can skip them.
const optionalSections = new Set(["open-source", "about"]);

const apiLinks = [
  {
    title: "OpenAPI JSON",
    url: toSiteUrl("/openapi.json"),
    description:
      "The OpenAPI contract: all endpoints, parameters, response schemas, and errors",
  },
  {
    title: "Interactive API reference",
    url: toSiteUrl("/openapi"),
    description:
      "The Scalar reference for the OpenAPI contract. You can send test requests from the browser",
  },
  {
    title: "MCP endpoint",
    url: toSiteUrl("/api/v1/mcp"),
    description:
      "POST only. The Model Context Protocol server, with the Streamable HTTP transport and JSON-RPC 2.0",
  },
  {
    title: "Mortgage rates",
    url: toSiteUrl("/api/v1/mortgage-rates"),
    description:
      "GET the newest mortgage rates of all lenders. Add termInMonths to get the fixed rates for one term",
  },
  {
    title: "Personal loan rates",
    url: toSiteUrl("/api/v1/personal-loan-rates"),
    description: "GET the newest personal loan rates of all lenders",
  },
  {
    title: "Car loan rates",
    url: toSiteUrl("/api/v1/car-loan-rates"),
    description: "GET the newest car loan rates of all lenders",
  },
  {
    title: "Credit card rates",
    url: toSiteUrl("/api/v1/credit-card-rates"),
    description: "GET the newest credit card rates of all issuers",
  },
  {
    title: "Health",
    url: toSiteUrl("/api/v1/health"),
    description:
      "GET the database status and the time of the last change to each dataset",
  },
];

function formatLink(title: string, url: string, description?: string): string {
  return description
    ? `- [${title}](${url}): ${description}`
    : `- [${title}](${url})`;
}

function formatPageLink(page: LlmsPage): string {
  return formatLink(
    page.data.title,
    toDocsUrl(page.url),
    page.data.description
  );
}

function isOptional(page: LlmsPage): boolean {
  const [section] = page.slugs;

  return section !== undefined && optionalSections.has(section);
}

function formatWhenToUse(): string {
  return whenToUseLinks
    .map((link) => formatLink(link.title, link.url, link.description))
    .join("\n");
}

// llms.txt in the llmstxt.org format: a title, a summary, details without
// headings, and then sections that are lists of links.
export function renderLlmsIndex(pages: LlmsPage[]): string {
  return [
    "# Rates API",
    `> ${summary}`,
    introduction,
    "## When to use Rates API",
    formatWhenToUse(),
    "## Docs",
    pages
      .filter((page) => !isOptional(page))
      .map(formatPageLink)
      .join("\n"),
    "## API",
    apiLinks
      .map((link) => formatLink(link.title, link.url, link.description))
      .join("\n"),
    "## Optional",
    [
      ...pages.filter(isOptional).map(formatPageLink),
      formatLink(
        "Full documentation text",
        toDocsUrl("/llms-full.txt"),
        "The full text of all the pages above, in one Markdown file"
      ),
    ].join("\n"),
  ].join("\n\n");
}

// llms-full.txt: the summary, then the full Markdown of each page.
export function renderLlmsFull(
  pages: { page: LlmsPage; markdown: string }[]
): string {
  return [
    `# Rates API documentation\n\n> ${summary}\n\n${introduction}\n\n## When to use Rates API\n\n${formatWhenToUse()}`,
    ...pages.map(({ page, markdown }) =>
      [
        `# ${page.data.title}`,
        `URL: ${toDocsUrl(page.url)}`,
        page.data.description,
        toAbsoluteLinks(markdown.trim()),
      ]
        .filter(Boolean)
        .join("\n\n")
    ),
  ].join("\n\n---\n\n");
}

// Plain text has no base URL, so change root-relative Markdown links to
// absolute URLs. Docs paths get /docs. API Worker paths do not.
export function toAbsoluteLinks(markdown: string): string {
  return markdown.replaceAll(
    /\]\((?<path>\/[^\s)]*)\)/gu,
    (_match, path: string) =>
      `](${isApiPath(path) ? toSiteUrl(path) : toDocsUrl(path)})`
  );
}
