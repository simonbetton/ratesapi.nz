import { Terminal } from "lucide-react";
import { apiLinks } from "./rates-api-content";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="site-logo" href="/" aria-label="Rates API home">
          <Terminal size={24} aria-hidden="true" />
          <span>Rates API</span>
        </a>
        <nav aria-label="Main navigation">
          <a className="nav-secondary" href="#endpoints">Endpoints</a>
          <a className="nav-secondary" href="#agents">For agents</a>
          <a className="nav-secondary" href={apiLinks.source}>GitHub</a>
          <a className="nav-docs" href={apiLinks.openapi}>API docs <span aria-hidden="true">↗</span></a>
          <a className="nav-start" href="#quickstart">Try the API <span aria-hidden="true">→</span></a>
        </nav>
      </div>
    </header>
  );
}
