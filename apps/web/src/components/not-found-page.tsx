import { ArrowRight } from "lucide-react";

import { SiteHeader } from "./header";
import { apiLinks } from "./rates-api-content";
import { SiteFooter } from "./static-sections";

// Shown for any URL without a route; the response keeps its 404 status.
export function NotFoundPage() {
  return (
    <div id="rates-home">
      {/* React hoists these into <head>. The root route adds no title,
          description or canonical, so nothing points at the homepage. */}
      <title>Page not found | Rates API</title>
      <meta content="noindex" name="robots" />
      <SiteHeader />
      <main className="page-container pb-16" id="main-content" tabIndex={-1}>
        <p className="eyebrow mt-16">Error 404</p>
        <h1>Page not found.</h1>
        <p className="mt-5 max-w-[560px]">
          This page doesn’t exist or has moved. The homepage and the docs are
          good places to start.
        </p>
        <div className="hero-actions">
          <a className="primary-link" href="/">
            Go to the homepage <ArrowRight size={17} aria-hidden="true" />
          </a>
          <a className="text-link" href={apiLinks.docs}>
            Read the docs <span aria-hidden="true">↗</span>
          </a>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
