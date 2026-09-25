import { ArrowUpRight, Play } from "lucide-react";
import { useState } from "react";

import {
  exampleResponse,
  languages,
  requestExample,
  requestUrl,
} from "../lib/api-examples";
import type { ExampleLanguage } from "../lib/api-examples";
import { fetchMortgageRates } from "../lib/rates-request";
import type { RequestResult } from "../lib/rates-request";
import { CopyButton } from "./copy-button";
import { apiLinks } from "./rates-api-content";

type RequestState = { status: "example" | "loading" } | RequestResult;

const responseLabels: Record<RequestState["status"], string> = {
  example: "Example response · shortened",
  loading: "Requesting live data…",
  success: "200 OK · Live response",
  error: "Request failed",
};

const responseNotes: Record<RequestState["status"], string> = {
  example:
    "Illustrative 1-year mortgage data. Run a request for the selected term’s latest available rates.",
  loading: "Fetching the selected mortgage term from ratesapi.nz.",
  success:
    "Check lastUpdated for data freshness; timestamp is the request time.",
  error: "No live data loaded. You can retry using Run request.",
};

const requestStatusMessages: Record<RequestState["status"], string> = {
  example: "",
  loading: "Requesting rates from the API.",
  success: "Request complete. Live JSON response ready.",
  error: "",
};

export function DemoPlayer() {
  const [language, setLanguage] = useState<ExampleLanguage>("cURL");
  const [term, setTerm] = useState("12");
  const [request, setRequest] = useState<RequestState>({ status: "example" });
  const snippet = requestExample(language, term);
  const loading = request.status === "loading";

  async function runRequest() {
    setRequest({ status: "loading" });
    setRequest(await fetchMortgageRates(term));
  }

  return (
    <section
      className="api-demo"
      id="quickstart"
      aria-labelledby="quickstart-title"
    >
      <div className="demo-heading">
        <h2 id="quickstart-title">Your first API call</h2>
        <span>No account. No API key.</span>
      </div>
      <div className="demo-grid">
        <div className="demo-request">
          <div className="code-toolbar">
            <div
              className="language-switch"
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a toggle-button group; <fieldset> adds UA min-inline-size and legend semantics we do not want
              role="group"
              aria-label="Code language"
            >
              {languages.map((item) => (
                <button
                  type="button"
                  key={item}
                  aria-pressed={language === item}
                  onClick={() => setLanguage(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <CopyButton key={snippet} text={snippet} />
          </div>
          <div className="request-filter">
            <label htmlFor="mortgage-term">Mortgage term</label>
            <select
              id="mortgage-term"
              value={term}
              disabled={loading}
              onChange={(event) => {
                setTerm(event.target.value);
                setRequest({ status: "example" });
              }}
            >
              <option value="">All terms</option>
              <option value="6">6 months</option>
              <option value="12">1 year</option>
              <option value="18">18 months</option>
              <option value="24">2 years</option>
              <option value="36">3 years</option>
              <option value="48">4 years</option>
              <option value="60">5 years</option>
            </select>
          </div>
          <pre
            className="request-code"
            // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable code block must be reachable by keyboard to scroll
            tabIndex={0}
            aria-label={`${language} request`}
          >
            <code>{snippet}</code>
          </pre>
          <div className="demo-actions">
            <button
              className="run-button"
              type="button"
              disabled={loading}
              onClick={runRequest}
            >
              <Play size={14} aria-hidden="true" />
              {loading ? "Requesting…" : "Run request"}
            </button>
            <a href={requestUrl(term)} target="_blank" rel="noreferrer">
              Open endpoint <ArrowUpRight size={14} aria-hidden="true" />
              <span className="sr-only"> (new tab)</span>
            </a>
          </div>
          <p className="demo-hint">
            Standard HTTP and JSON. Works with fetch, your backend, or a
            notebook.
          </p>
        </div>
        <div className="demo-response" aria-busy={loading}>
          <div className="code-toolbar">
            <span className="response-label">
              {responseLabels[request.status]}
            </span>
            <span className="json-label">JSON</span>
          </div>
          {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- <output> is not announced as a live region consistently across screen readers */}
          <div role="status" className="sr-only">
            {requestStatusMessages[request.status]}
          </div>
          {request.status === "error" ? (
            <div className="request-error" role="alert">
              <strong>Request unavailable</strong>
              <p>{request.message}</p>
              <a href={apiLinks.health} target="_blank" rel="noreferrer">
                Check service health <span className="sr-only">(new tab)</span>
              </a>
            </div>
          ) : (
            <pre
              className="response-code"
              // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable code block must be reachable by keyboard to scroll
              tabIndex={0}
              aria-label={
                request.status === "success"
                  ? "Live JSON response"
                  : "Illustrative JSON response"
              }
            >
              <code>
                {request.status === "success"
                  ? request.body
                  : JSON.stringify(exampleResponse, null, 2)}
              </code>
            </pre>
          )}
          <p className="response-note">{responseNotes[request.status]}</p>
        </div>
      </div>
    </section>
  );
}
