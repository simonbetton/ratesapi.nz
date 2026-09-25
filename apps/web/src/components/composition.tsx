import { ChannelsSection } from "./channels-section";
import { DeveloperSection, QuestionsSection } from "./developer-section";
import { SiteHeader } from "./header";
import { HeroSection } from "./hero-section";
import { MobileNav } from "./mobile-nav";
import { RatesExplorer } from "./rates-explorer";
import {
  AutomationsSection,
  FooterCtaSection,
  SiteFooter,
  TeamStrategySection,
} from "./static-sections";

export function Page() {
  return (
    <div id="rates-home">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <HeroSection />
        <ChannelsSection />
        <RatesExplorer />
        <TeamStrategySection />
        <DeveloperSection />
        <AutomationsSection />
        <QuestionsSection />
        <FooterCtaSection />
      </main>
      <SiteFooter />
      <MobileNav />
    </div>
  );
}
