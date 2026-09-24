import { ArrowUpRight } from "lucide-react";

import { mcpRequest } from "../lib/api-examples";
import { CopyButton } from "./copy-button";
import { apiLinks } from "./rates-api-content";

export function DeveloperSection() {
  return (
    <section
      className="developer-section section-space"
      id="agents"
      aria-labelledby="agents-title"
    >
      <div className="page-container developer-grid">
        <div>
          <p className="eyebrow">For developers. And their agents.</p>
          <h2 id="agents-title">
            Real rates behind
            <br />
            your next answer.
          </h2>
          <p>
            Give your assistant a structured way to retrieve lending rates. The
            public MCP endpoint supports tool discovery and calls for current
            and historical data.
          </p>
          <a className="text-link" href={apiLinks.mcpDocs}>
            Read the MCP integration guide{" "}
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
          <div className="developer-resources">
            <a href={apiLinks.openapiJson}>
              <strong>Generate a client</strong>
              <span>
                OpenAPI JSON <ArrowUpRight size={14} aria-hidden="true" />
              </span>
            </a>
            <a href="https://ratesapi.nz/llms.txt">
              <strong>Give your agent the docs</strong>
              <span>
                llms.txt <ArrowUpRight size={14} aria-hidden="true" />
              </span>
            </a>
          </div>
        </div>
        <div className="mcp-example">
          <div className="code-toolbar">
            <span>POST /api/v1/mcp</span>
            <CopyButton text={mcpRequest} label="Copy MCP request" />
          </div>
          {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable code block must be reachable by keyboard to scroll */}
          <pre tabIndex={0} aria-label="MCP curl request">
            <code>{mcpRequest}</code>
          </pre>
          <p>
            Call <code>tools/list</code> to discover available tools.
          </p>
        </div>
      </div>
    </section>
  );
}

export function QuestionsSection() {
  return (
    <section
      className="page-container section-space questions-section"
      id="integration-notes"
      aria-labelledby="questions-title"
    >
      <div>
        <p className="eyebrow">Before you ship</p>
        <h2 id="questions-title">A few useful details.</h2>
        <a
          className="text-link"
          href="https://ratesapi.nz/api-reference/concepts"
        >
          Read the integration notes{" "}
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </div>
      <dl className="questions">
        <div>
          <dt>Is the hosted API free?</dt>
          <dd>
            Yes. Public endpoints need no account, API key, or payment details.
            The source code is MIT licensed, so you can also run your own
            instance.
          </dd>
        </div>
        <div>
          <dt>Where do the rates come from?</dt>
          <dd>
            Data is collected from{" "}
            <a href="https://www.interest.co.nz/">interest.co.nz</a>. Collection
            is scheduled hourly, but freshness varies by dataset. Check{" "}
            <code>lastUpdated</code> and confirm rates and eligibility with the
            provider before relying on an offer.
          </dd>
        </div>
        <div>
          <dt>Can I call it from a browser?</dt>
          <dd>
            Yes. Public API routes allow cross-origin requests without
            credentials. Use native <code>fetch</code> or any HTTP client. Check
            HTTP status codes, handle unavailable data, and cache responses
            where appropriate.
          </dd>
        </div>
        <div>
          <dt>How do I query historical rates?</dt>
          <dd>
            Add <code>/time-series</code> to a category route. Use{" "}
            <code>date</code> for one day, or <code>startDate</code> and{" "}
            <code>endDate</code> together for a range. Responses include{" "}
            <code>availableDates</code>; coverage depends on stored snapshots.{" "}
            <a href="https://ratesapi.nz/api-reference/endpoint/mortgage-rates/time-series">
              See a mortgage history example.
            </a>
          </dd>
        </div>
      </dl>
    </section>
  );
}
