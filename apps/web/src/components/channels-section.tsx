import { ArrowUpRight } from "lucide-react";

import { keyFactStats, keyFactsSummary } from "../lib/key-facts";
import type { KeyFacts } from "../lib/key-facts";
import { apiOrigin } from "../lib/site-urls";
import { cn } from "../lib/utils";
import { endpointCards } from "./rates-api-content";

export function ChannelsSection({ keyFacts }: { keyFacts: KeyFacts | null }) {
  return (
    <section
      className="page-container section-space"
      id="endpoints"
      aria-labelledby="endpoints-title"
    >
      <div className="section-intro">
        <p className="eyebrow">Four datasets. One integration.</p>
        <h2 id="endpoints-title">The lending rates your product needs.</h2>
        <p>
          Start with a category. Every family has endpoints for the latest data,
          a single provider, and historical snapshots.
        </p>
      </div>
      <div className="endpoint-grid">
        {endpointCards.map((card, index) => (
          <article className="endpoint-card" key={card.title}>
            <div className="endpoint-card-heading">
              <span className="endpoint-number">0{index + 1}</span>
              <span className="method-label">GET</span>
            </div>
            <h3>
              <a href={card.href}>
                {card.title}
                <ArrowUpRight size={18} aria-hidden="true" />
              </a>
            </h3>
            <p>{card.body}</p>
            <code>{card.path}</code>
          </article>
        ))}
      </div>
      <KeyFactsBlock facts={keyFacts} />
      <p className="endpoint-footnote">
        Base URL <code>{apiOrigin}</code>
        <span aria-hidden="true"> · </span>JSON responses · Browser CORS enabled
      </p>
    </section>
  );
}

// Rendered on the server from live API data (see routes/index.tsx), so the
// numbers are in the HTML that search engines and assistants read.
function KeyFactsBlock({ facts }: { facts: KeyFacts | null }) {
  return (
    <div className={cn("key-facts", !facts && "is-static")}>
      <h3>Key facts</h3>
      <p>{keyFactsSummary(facts)}</p>
      {facts && (
        <dl className="key-facts-stats">
          {keyFactStats(facts).map((stat) => (
            <div key={stat.label}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
