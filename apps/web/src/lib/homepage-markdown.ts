// The homepage as Markdown, for agents that send Accept: text/markdown. It
// has the content of the page without its navigation and widgets, and it
// uses the same text and live key facts as the HTML page.

import {
  apiLinks,
  endpointCards,
  heroContent,
  homepageMeta,
  integrationNotes,
} from "../components/rates-api-content";
import { mcpRequest, requestExample } from "./api-examples";
import { keyFactStats, keyFactsSummary } from "./key-facts";
import type { KeyFacts } from "./key-facts";
import { inlineMarkdown } from "./page-content";
import { apiOrigin, siteOrigin } from "./site-urls";

function keyFactsSection(facts: KeyFacts | null) {
  const summary = keyFactsSummary(facts);
  if (!facts) {
    return ["## Key facts", summary];
  }
  return [
    "## Key facts",
    summary,
    [
      "| Dataset | Lenders or issuers |",
      "| --- | --- |",
      ...keyFactStats(facts).map((stat) => `| ${stat.label} | ${stat.value} |`),
    ].join("\n"),
  ];
}

// Each job links to the request that does it, so an agent knows how to call
// the API, not only what it contains.
const whenToUse = [
  "## When to use Rates API",
  "Use Rates API when a person or a task needs New Zealand lending rates:",
  [
    `- Compare the newest mortgage rates of New Zealand banks and lenders, for all terms or one fixed term: \`GET ${apiOrigin}/api/v1/mortgage-rates?termInMonths=12\``,
    `- Get the rates of one lender: \`GET ${apiOrigin}/api/v1/mortgage-rates/institution:anz\``,
    `- Show how rates changed over time: \`GET ${apiOrigin}/api/v1/mortgage-rates/time-series?startDate=2026-01-01&endDate=2026-03-31\``,
    "- Compare personal loan rates, car loan rates, or credit card rates and fees, with the endpoints below",
    `- Give an AI agent these jobs as tools: connect it to the MCP endpoint, \`POST ${apiOrigin}/api/v1/mcp\``,
  ].join("\n"),
  "Do not use Rates API for rates outside New Zealand, for savings or term deposit rates, for exchange rates, or as financial advice. The data can be late or incorrect, so confirm a rate with the lender before you rely on it.",
];

function endpointsSection() {
  return [
    "## Endpoints",
    "Every dataset has endpoints for the newest data, a single provider, and historical snapshots.",
    [
      "| Dataset | Newest rates | One provider | History |",
      "| --- | --- | --- | --- |",
      ...endpointCards.map(
        (card) =>
          `| [${card.title}](${card.href}) | \`${card.path}\` | \`${card.path}/{${card.idParameter}}\` | \`${card.path}/time-series\` |`
      ),
    ].join("\n"),
    `Base URL \`${apiOrigin}\` · JSON responses · Browser CORS enabled. Every endpoint, parameter, and response is in the [OpenAPI document](${apiLinks.openapiJson}).`,
  ];
}

const forAgents = [
  "## For AI agents",
  [
    `- [MCP endpoint](${apiLinks.mcpDocs}): \`POST ${apiOrigin}/api/v1/mcp\`, with the Streamable HTTP transport and no authentication. Call \`tools/list\` to find the tools.`,
    `- [OpenAPI document](${apiLinks.openapiJson}): the contract for SDK and tool generators, with an operation ID and a description for each endpoint`,
    `- [llms.txt](${apiLinks.llmsTxt}): the documentation pages, listed for language models`,
  ].join("\n"),
  "An MCP tool call:",
  `\`\`\`bash\n${mcpRequest}\n\`\`\``,
];

const morePages = [
  "## More",
  [
    `- [Documentation](${apiLinks.docs})`,
    `- [About Rates API](${siteOrigin}/about)`,
    `- [Contact](${siteOrigin}/contact)`,
    `- [Privacy notice](${siteOrigin}/privacy)`,
    `- [Source code on GitHub](${apiLinks.source})`,
  ].join("\n"),
];

export function homepageMarkdown(facts: KeyFacts | null) {
  return [
    "# Rates API",
    `> ${homepageMeta.description}`,
    `${heroContent.title} ${heroContent.titleEnd} ${heroContent.description}`,
    heroContent.proof.map((feature) => `- ${feature}`).join("\n"),
    ...keyFactsSection(facts),
    ...whenToUse,
    ...endpointsSection(),
    "## Quick start",
    `\`\`\`bash\n${requestExample("cURL", "12")}\n\`\`\``,
    ...forAgents,
    "## Before you ship",
    ...integrationNotes.flatMap((note) => [
      `### ${note.question}`,
      inlineMarkdown(note.answer),
    ]),
    ...morePages,
  ]
    .join("\n\n")
    .concat("\n");
}

// No part of the request is repeated here, so a crafted URL cannot put text
// into what an agent reads.
export const notFoundMarkdown = `# Page not found

This page does not exist or has moved. Rates API is a free JSON API for New Zealand mortgage, personal loan, car loan, and credit card interest rates.

These pages list what the site has:

- [Homepage](${siteOrigin}/): what Rates API does, with its endpoints and key facts
- [Documentation](${apiLinks.docs}): guides and the API reference
- [llms.txt](${apiLinks.llmsTxt}): the documentation pages, listed for language models
- [OpenAPI document](${apiLinks.openapiJson}): every endpoint, parameter, and response
- [Sitemap](${siteOrigin}/sitemap.xml): every page of this site
`;
