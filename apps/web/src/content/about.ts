import { apiLinks } from "../components/rates-api-content";
import type { ContentPage } from "../lib/page-content";

export const aboutPage: ContentPage = {
  path: "/about",
  schemaType: "AboutPage",
  title: "About Rates API",
  eyebrow: "About",
  description:
    "Rates API is a free, open-source JSON API for New Zealand lending rates, made and run by Simon Betton. How it works, where the data comes from, and its limits.",
  lede: [
    "Rates API is a free, open-source JSON API for New Zealand mortgage, personal loan, car loan, and credit card interest rates. It lets developers and AI agents use current and historical lending rates without writing and maintaining their own scrapers.",
  ],
  blocks: [
    { kind: "heading", text: "What Rates API does" },
    {
      kind: "paragraph",
      content: [
        "Every hour, Rates API reads the rate tables that ",
        { text: "interest.co.nz", href: "https://www.interest.co.nz/" },
        " publishes, groups the rates by institution and product, and stores the newest data. On each day that a dataset changes, it also keeps a snapshot, so the history shows what the API returned on that date. The history starts on 8 March 2025.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "The data is served as JSON from Cloudflare Workers. An ",
        { text: "OpenAPI document", href: apiLinks.openapiJson },
        " describes every endpoint for code and tool generators, an ",
        { text: "MCP endpoint", href: apiLinks.mcpDocs },
        " lets AI agents call the same data as tools, and ",
        { text: "llms.txt", href: apiLinks.llmsTxt },
        " lists the documentation for language models. No account, API key, or payment is needed.",
      ],
    },
    { kind: "heading", text: "Who runs it" },
    {
      kind: "paragraph",
      content: [
        "Rates API is made and run by ",
        { text: "Simon Betton", href: apiLinks.author },
        ", an independent software developer. It is an open-source project: the code, the issues, and the history of every change are public in the ",
        { text: "GitHub repository", href: apiLinks.source },
        ", and the code is MIT licensed, so you can also run your own copy.",
      ],
    },
    { kind: "heading", text: "Independence and limits" },
    {
      kind: "paragraph",
      content: [
        "Rates API is independent. It is not affiliated with, or endorsed by, interest.co.nz or any bank, lender, or card issuer.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "The data can be incomplete, incorrect, or late: a lender can change a rate between two checks, and a change to a source page can stop the collection until the scrapers are repaired. Rates API does not give financial advice. Confirm a rate and its conditions with the lender before you make a decision.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "The MIT licence covers the code, not the rates. The terms of interest.co.nz apply to the rate data. For fair use rules and the licence of the data, read ",
        { text: "the data source and terms", href: apiLinks.about },
        " in the documentation.",
      ],
    },
    { kind: "heading", text: "Get in touch" },
    {
      kind: "paragraph",
      content: [
        "To report a problem, ask a question, or suggest a change, use the ",
        { text: "contact page", href: "/contact" },
        ". The ",
        { text: "privacy notice", href: "/privacy" },
        " explains what data the service handles.",
      ],
    },
  ],
};
