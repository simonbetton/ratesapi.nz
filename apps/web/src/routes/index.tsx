import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { Page } from "#/components/composition";
import { loadKeyFacts } from "#/lib/key-facts.server";
import { homepageStructuredData, jsonLdScript } from "#/lib/structured-data";

const title = "Free NZ Mortgage & Interest Rates API (JSON) | Rates API";
const description =
  "Free JSON API for NZ mortgage, personal loan, car loan and credit card interest rates from 30+ lenders. Updated hourly, with daily history. No API key.";
const socialDescription =
  "Latest and historical NZ lending rates for products, dashboards, and agent tools.";
const url = "https://www.ratesapi.nz/";
const image = "https://www.ratesapi.nz/images/og-card.png";
const imageAlt = "Rates API: free New Zealand interest rates API";

// Runs on the server, where the API Worker is reachable through a service
// binding. On the client, TanStack Start turns this into a fetch.
const getKeyFacts = createServerFn({ method: "GET" }).handler(() =>
  loadKeyFacts()
);

export const Route = createFileRoute("/")({
  loader: () => getKeyFacts(),
  // The facts change hourly at most; don't refetch them after hydration.
  staleTime: Number.POSITIVE_INFINITY,
  head: ({ loaderData }) => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: socialDescription },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { property: "og:site_name", content: "Rates API" },
      { property: "og:image", content: image },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:alt", content: imageAlt },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: socialDescription },
      { name: "twitter:image", content: image },
      { name: "twitter:image:alt", content: imageAlt },
    ],
    links: [
      { rel: "canonical", href: url },
      // The hero background is the largest paint. Each URL and media query
      // matches the .hero rules in styles.css, so the preload is reused.
      {
        rel: "preload",
        href: "/images/hero.webp",
        as: "image",
        fetchPriority: "high",
        media: "(min-width: 521px)",
      },
      {
        rel: "preload",
        href: "/images/hero-mobile.webp",
        as: "image",
        fetchPriority: "high",
        media: "(max-width: 520px)",
      },
      // API discovery (RFC 8631 and RFC 9727).
      {
        rel: "service-desc",
        href: "https://www.ratesapi.nz/openapi/json",
        type: "application/vnd.oai.openapi+json",
      },
      {
        rel: "service-doc",
        href: "https://www.ratesapi.nz/docs/api-reference",
        type: "text/html",
      },
      {
        rel: "api-catalog",
        href: "https://www.ratesapi.nz/.well-known/api-catalog",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: jsonLdScript(homepageStructuredData(loaderData ?? null)),
      },
    ],
  }),
  component: Home,
});

function Home() {
  const keyFacts = Route.useLoaderData();
  return <Page keyFacts={keyFacts} />;
}
