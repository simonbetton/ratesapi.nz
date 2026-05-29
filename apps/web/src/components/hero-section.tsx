import { ArrowRight, Check } from "lucide-react";
import { DemoPlayer } from "./demo-player";
import { apiLinks } from "./rates-api-content";

export function HeroSection() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="page-container">
        <div className="hero-copy">
          <p className="eyebrow">New Zealand lending data, ready to build with</p>
          <h1 id="hero-title">Build the product.<br /><span>We’ll bring the rates.</span></h1>
          <p className="hero-description">Add New Zealand mortgage, loan, and credit card rates to your app with one free JSON API. Build comparisons, calculators, and agents without maintaining your own scrapers.</p>
          <div className="hero-actions">
            <a className="primary-link" href="#quickstart">Make your first request <ArrowRight size={17} aria-hidden="true" /></a>
            <a className="text-link" href={apiLinks.openapi}>Explore the API docs <span aria-hidden="true">↗</span></a>
          </div>
          <ul className="hero-proof" aria-label="API features">
            {["Free to use", "No API key", "Open source · MIT"].map((feature) => <li key={feature}><Check size={14} aria-hidden="true" />{feature}</li>)}
          </ul>
        </div>
        <DemoPlayer />
      </div>
    </section>
  );
}
