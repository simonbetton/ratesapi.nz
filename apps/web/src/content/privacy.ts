import { apiLinks } from "../components/rates-api-content";
import type { ContentPage } from "../lib/page-content";

// Keep this text true to the code: when a page adds a script, a cookie, a
// third-party request, or a new log, update the notice and `updated`.
export const privacyPage: ContentPage = {
  path: "/privacy",
  schemaType: "WebPage",
  title: "Privacy notice",
  eyebrow: "Privacy",
  description:
    "What data Rates API handles when you use the website, the API, or the MCP endpoint, who processes it, and how long it is kept.",
  lede: [
    "Rates API has no user accounts and does not ask for personal information. The website and the API do not use cookies, analytics, or advertising. This notice explains the data that the service does handle.",
  ],
  blocks: [
    { kind: "heading", text: "Data that each request contains" },
    {
      kind: "paragraph",
      content: [
        "Cloudflare hosts the website, the documentation, and the API. When your browser, app, or agent sends a request to www.ratesapi.nz, Cloudflare receives the technical details that every web request contains, for example:",
      ],
    },
    {
      kind: "list",
      items: [
        ["Your IP address, and the approximate location that it shows"],
        ["The URL, the time, and the response status of the request"],
        ["Request headers, such as the user agent and the referrer"],
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Rates API uses these details only to send responses, to keep the service secure and available, and to find and fix errors. It does not use them to identify you or to build a profile, and it does not sell or share them.",
      ],
    },
    { kind: "heading", text: "Logs and how long they are kept" },
    {
      kind: "paragraph",
      content: [
        "The Workers that run the site write logs of requests and errors to Cloudflare Workers Logs. These logs can contain the details above, including your IP address. Cloudflare deletes them automatically after a maximum of 7 days, and only the maintainer can read them.",
      ],
    },
    { kind: "heading", text: "Cookies and browser storage" },
    {
      kind: "paragraph",
      content: [
        "The website and the API do not set cookies, and there are no analytics scripts, advertising, or tracking pixels. Cloudflare can set a cookie that is necessary for security, for example to tell people from bots.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Your browser keeps two settings for the pages on your device: the scroll position of each page, in session storage, so that the back button returns you to the same place, and, if you choose one, the light or dark theme of the documentation, in local storage. These settings stay in your browser and are not sent to Rates API.",
      ],
    },
    { kind: "heading", text: "Other services" },
    {
      kind: "list",
      items: [
        [
          {
            text: "Cloudflare",
            href: "https://www.cloudflare.com/privacypolicy/",
          },
          " hosts the site and processes every request.",
        ],
        [
          "The interactive API reference at ",
          { text: "/openapi", href: apiLinks.openapi },
          " loads its code from ",
          {
            text: "jsDelivr",
            href: "https://www.jsdelivr.com/terms/privacy-policy-jsdelivr-net",
          },
          " and its fonts from ",
          { text: "Scalar", href: "https://scalar.com/legal/privacy-policy" },
          ". These services receive your IP address when you open that page. The other pages load nothing from other services.",
        ],
        [
          "If you open an issue or a pull request on GitHub, the ",
          {
            text: "GitHub privacy statement",
            href: "https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement",
          },
          " applies, and what you write is public.",
        ],
      ],
    },
    { kind: "heading", text: "The rate data" },
    {
      kind: "paragraph",
      content: [
        "The API serves interest rates, fees, and product names that lenders publish. This data is about financial products, not about people, and contains no personal information.",
      ],
    },
    { kind: "heading", text: "Questions and changes" },
    {
      kind: "paragraph",
      content: [
        "For a question about this notice, use the ",
        { text: "contact page", href: "/contact" },
        ". Do not put personal information in a public GitHub issue. When the service changes how it handles data, this notice changes too, and the date below shows the last update.",
      ],
    },
  ],
  updated: "2026-09-28",
};
