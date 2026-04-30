import { llms, loader, source } from "fumadocs-core/source";

type DocsBlock =
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "list";
      items: string[];
    }
  | {
      type: "links";
      links: {
        href: string;
        label: string;
        description: string;
      }[];
    };

export type DocsPageData = {
  title: string;
  description: string;
  blocks: DocsBlock[];
};

export const docsSource = loader(
  source<DocsPageData, { title: string; pages: string[] }>({
    pages: [
      {
        type: "page",
        path: "index.mdx",
        slugs: [],
        data: {
          title: "Rates API",
          description:
            "Free OpenAPI access to New Zealand lending rates, updated hourly.",
          blocks: [
            {
              type: "paragraph",
              text: "Rates API provides mortgage, personal loan, car loan, and credit card rate data through a Cloudflare Worker backed by D1.",
            },
            {
              type: "links",
              links: [
                {
                  href: "/openapi",
                  label: "OpenAPI UI",
                  description:
                    "Explore the interactive API reference generated from the live Worker schema.",
                },
                {
                  href: "/openapi/json",
                  label: "OpenAPI JSON",
                  description:
                    "Download the machine-readable OpenAPI specification.",
                },
                {
                  href: "/api/v1/health",
                  label: "Health",
                  description:
                    "Check the freshness of each data set served by the API.",
                },
              ],
            },
            {
              type: "list",
              items: [
                "Runs directly inside the existing Cloudflare Worker.",
                "Uses Fumadocs Core's loader API with an in-memory source.",
                "Keeps API routes under /api/v1 unchanged.",
              ],
            },
          ],
        },
      },
      {
        type: "page",
        path: "api-reference.mdx",
        slugs: ["api-reference"],
        data: {
          title: "API reference",
          description: "Endpoint categories available from /api/v1.",
          blocks: [
            {
              type: "list",
              items: [
                "Mortgage rates: /api/v1/mortgage-rates",
                "Personal loan rates: /api/v1/personal-loan-rates",
                "Car loan rates: /api/v1/car-loan-rates",
                "Credit card rates: /api/v1/credit-card-rates",
                "MCP tools: /api/v1/mcp",
              ],
            },
          ],
        },
      },
      {
        type: "page",
        path: "cloudflare-worker.mdx",
        slugs: ["cloudflare-worker"],
        data: {
          title: "Cloudflare Worker support",
          description:
            "The documentation route is served by the same Worker as the API.",
          blocks: [
            {
              type: "paragraph",
              text: "This Fumadocs integration uses the headless loader API at runtime and avoids filesystem, Node.js server, and Next.js runtime requirements.",
            },
            {
              type: "paragraph",
              text: "Wrangler can bundle the docs source with the Worker entrypoint, so the root route works in development and production Worker environments.",
            },
          ],
        },
      },
    ],
    metas: [
      {
        type: "meta",
        path: "meta.json",
        data: {
          title: "Rates API",
          pages: ["index", "api-reference", "cloudflare-worker"],
        },
      },
    ],
  }),
  {
    baseUrl: "/",
  },
);

export const docsLlms = llms(docsSource);
