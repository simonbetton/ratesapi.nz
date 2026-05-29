import { ArrowUpRight, Play } from "lucide-react";
import { useState } from "react";
import { type ExampleLanguage, exampleResponse, languages, requestExample, requestUrl } from "../lib/api-examples";
import { CopyButton } from "./copy-button";
import { apiLinks } from "./rates-api-content";

type RequestState =
  | { status: "example" | "loading" }
  | { status: "success"; body: string }
  | { status: "error"; message: string };

export function DemoPlayer() {
  const [language, setLanguage] = useState<ExampleLanguage>("cURL");
  const [term, setTerm] = useState("12");
  const [request, setRequest] = useState<RequestState>({ status: "example" });
  const snippet = requestExample(language, term);
  const loading = request.status === "loading";

  async function runRequest() {
    setRequest({ status: "loading" });
    try {
      const response = await fetch(requestUrl(term), { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) {
        throw new Error(`The API returned HTTP ${response.status}. Try again or check service health.`);
      }
      const body: unknown = await response.json();
      setRequest({ status: "success", body: JSON.stringify(body, null, 2) });
    } catch (error) {
      setRequest({
        status: "error",
        message: error instanceof Error && error.message.startsWith("The API returned")
          ? error.message
          : "Could not reach the API. Check your connection and retry, or open the endpoint directly.",
      });
    }
  }

  return (
    <section className="api-demo" id="quickstart" aria-labelledby="quickstart-title">
      <div className="demo-heading">
        <h2 id="quickstart-title">Your first API call</h2>
        <span>No account. No API key.</span>
      </div>
      <div className="demo-grid">
        <div className="demo-request">
          <div className="code-toolbar">
            <div className="language-switch" role="group" aria-label="Code language">
              {languages.map((item) => (
                <button type="button" key={item} aria-pressed={language === item} onClick={() => setLanguage(item)}>{item}</button>
              ))}
            </div>
            <CopyButton key={snippet} text={snippet} />
          </div>
          <div className="request-filter">
            <label htmlFor="mortgage-term">Mortgage term</label>
            <select id="mortgage-term" value={term} disabled={loading} onChange={(event) => {
              setTerm(event.target.value);
              setRequest({ status: "example" });
            }}>
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
          <pre className="request-code" tabIndex={0} aria-label={`${language} request`}><code>{snippet}</code></pre>
          <div className="demo-actions">
            <button className="run-button" type="button" disabled={loading} onClick={runRequest}>
              <Play size={14} aria-hidden="true" />{loading ? "Requesting…" : "Run request"}
            </button>
            <a href={requestUrl(term)} target="_blank" rel="noreferrer">Open endpoint <ArrowUpRight size={14} aria-hidden="true" /><span className="sr-only"> (new tab)</span></a>
          </div>
          <p className="demo-hint">Standard HTTP and JSON. Works with fetch, your backend, or a notebook.</p>
        </div>
        <div className="demo-response" aria-busy={loading}>
          <div className="code-toolbar">
            <span className="response-label">{request.status === "success" ? "200 OK · Live response" : "Example response · shortened"}</span>
            <span className="json-label">JSON</span>
          </div>
          <div role="status" className="sr-only">{loading ? "Requesting rates from the API." : request.status === "success" ? "Request complete. Live JSON response ready." : ""}</div>
          {request.status === "error" ? (
            <div className="request-error" role="alert">
              <strong>Request unavailable</strong>
              <p>{request.message}</p>
              <a href={apiLinks.health} target="_blank" rel="noreferrer">Check service health <span className="sr-only">(new tab)</span></a>
            </div>
          ) : (
            <pre className="response-code" tabIndex={0} aria-label={request.status === "success" ? "Live JSON response" : "Illustrative JSON response"}>
              <code>{request.status === "success" ? request.body : JSON.stringify(exampleResponse, null, 2)}</code>
            </pre>
          )}
          <p className="response-note">{request.status === "success" ? "Check lastUpdated for data freshness; timestamp is the request time." : "Illustrative 1-year mortgage data. Run a request for the selected term’s latest available rates."}</p>
        </div>
      </div>
    </section>
  );
}
