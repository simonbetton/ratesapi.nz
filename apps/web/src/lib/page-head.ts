import type { ContentPage } from "./page-content";
import { siteOrigin } from "./site-urls";
import { contentPageStructuredData, jsonLdScript } from "./structured-data";

const image = `${siteOrigin}/images/og-card.png`;
const imageAlt = "Rates API: free New Zealand interest rates API";

/** Open Graph and Twitter tags. Every page shares the social card image. */
export function socialMeta(options: {
  title: string;
  description: string;
  url: string;
}) {
  return [
    { property: "og:title", content: options.title },
    { property: "og:description", content: options.description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: options.url },
    { property: "og:site_name", content: "Rates API" },
    { property: "og:image", content: image },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:type", content: "image/png" },
    { property: "og:image:alt", content: imageAlt },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: options.title },
    { name: "twitter:description", content: options.description },
    { name: "twitter:image", content: image },
    { name: "twitter:image:alt", content: imageAlt },
  ];
}

/** The <head> of a text page: title, description, canonical and JSON-LD. */
export function contentPageHead(page: ContentPage) {
  // "About Rates API" needs no " | Rates API" after it.
  const title = page.title.includes("Rates API")
    ? page.title
    : `${page.title} | Rates API`;
  const url = `${siteOrigin}${page.path}`;
  return {
    meta: [
      { title },
      { name: "description", content: page.description },
      ...socialMeta({ title, description: page.description, url }),
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: [
      {
        type: "application/ld+json",
        children: jsonLdScript(contentPageStructuredData(page)),
      },
    ],
  };
}
