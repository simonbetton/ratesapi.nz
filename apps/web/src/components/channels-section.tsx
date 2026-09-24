import { ArrowUpRight } from "lucide-react";
import { endpointCards } from "./rates-api-content";

export function ChannelsSection() {
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
      <p className="endpoint-footnote">
        Base URL <code>https://ratesapi.nz</code>
        <span aria-hidden="true"> · </span>JSON responses · Browser CORS enabled
      </p>
    </section>
  );
}
