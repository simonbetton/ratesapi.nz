import { ArrowUpRight } from "lucide-react";

import { mcpRequest } from "../lib/api-examples";
import { CopyButton } from "./copy-button";
import { InlineContent } from "./inline-content";
import { apiLinks, integrationNotes } from "./rates-api-content";

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
            <a href={apiLinks.llmsTxt}>
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
        <a className="text-link" href={apiLinks.concepts}>
          Read the integration notes{" "}
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </div>
      <dl className="questions">
        {integrationNotes.map((note) => (
          <div key={note.question}>
            <dt>{note.question}</dt>
            <dd>
              <InlineContent content={note.answer} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
