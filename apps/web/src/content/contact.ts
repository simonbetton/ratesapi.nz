import { apiLinks } from "../components/rates-api-content";
import type { ContentPage } from "../lib/page-content";

export const contactPage: ContentPage = {
  path: "/contact",
  schemaType: "ContactPage",
  title: "Contact Rates API",
  eyebrow: "Contact",
  description:
    "How to report a problem, an incorrect rate, or a security issue with Rates API, and how to ask a question or suggest a change.",
  lede: [
    "Rates API is an open-source project run by one developer. GitHub is the way to reach the project: issues are public, so other users can find the answers too.",
  ],
  blocks: [
    { kind: "heading", text: "Report a problem or an incorrect rate" },
    {
      kind: "paragraph",
      content: [
        "Open an issue in the ",
        { text: "GitHub issue tracker", href: `${apiLinks.source}/issues` },
        ". These details help to find the cause quickly:",
      ],
    },
    {
      kind: "list",
      items: [
        [
          "The full request URL, for example ",
          { code: "https://www.ratesapi.nz/api/v1/mortgage-rates" },
        ],
        ["The time of the request"],
        ["What you expected, and the status and body of the response"],
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Rates API reports published rates. Include the sourceUrl and the product conditions when you report a problem. Confirm the current offer with the institution.",
      ],
    },
    { kind: "heading", text: "Report a security issue" },
    {
      kind: "paragraph",
      content: [
        "Do not describe a vulnerability in a public issue. Report it privately with ",
        {
          text: "GitHub private vulnerability reporting",
          href: `${apiLinks.source}/security/advisories/new`,
        },
        ". Only the maintainer can see the report.",
      ],
    },
    { kind: "heading", text: "Ask a question or suggest a change" },
    {
      kind: "paragraph",
      content: [
        "Questions, ideas, and pull requests are welcome in the ",
        { text: "GitHub repository", href: apiLinks.source },
        ". The ",
        { text: "documentation", href: apiLinks.docs },
        " answers most questions about endpoints, IDs, dates, and errors, and agents can start with ",
        { text: "llms.txt", href: apiLinks.llmsTxt },
        ".",
      ],
    },
    { kind: "heading", text: "Service status" },
    {
      kind: "paragraph",
      content: [
        "To see whether the API is up and how fresh each dataset is, send a request to ",
        { text: "/api/v1/health", href: apiLinks.health },
        ". An automated check tests the production API every 15 minutes and opens a GitHub issue when a check fails.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Rates API is free and has no service level agreement, so there is no guaranteed response time.",
      ],
    },
  ],
};
