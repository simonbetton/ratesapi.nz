import { ArrowRight, Check } from "lucide-react";

import { DemoPlayer } from "./demo-player";
import { apiLinks, heroContent } from "./rates-api-content";

export function HeroSection() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="page-container">
        <div className="hero-copy">
          <p className="eyebrow">{heroContent.eyebrow}</p>
          <h1 id="hero-title">
            {heroContent.title}
            <span className="text-pretty">{heroContent.titleEnd}</span>
          </h1>
          <p className="hero-description text-pretty">
            {heroContent.description}
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#quickstart">
              Make your first request{" "}
              <ArrowRight size={17} aria-hidden="true" />
            </a>
            <a className="text-link" href={apiLinks.quickstart}>
              Explore the API docs <span aria-hidden="true">↗</span>
            </a>
          </div>
          <ul className="hero-proof" aria-label="API features">
            {heroContent.proof.map((feature) => (
              <li key={feature}>
                <Check size={14} aria-hidden="true" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
        <DemoPlayer />
      </div>
    </section>
  );
}
