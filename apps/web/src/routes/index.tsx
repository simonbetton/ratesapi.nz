import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { Page } from "#/components/composition";
import { homepageMeta } from "#/components/rates-api-content";
import { loadKeyFacts } from "#/lib/key-facts.server";
import { socialMeta } from "#/lib/page-head";
import { homepageStructuredData, jsonLdScript } from "#/lib/structured-data";

const { title, description, socialDescription } = homepageMeta;
const url = "https://www.ratesapi.nz/";

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
      ...socialMeta({ title, description: socialDescription, url }),
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
        href: "https://www.ratesapi.nz/openapi.json",
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
