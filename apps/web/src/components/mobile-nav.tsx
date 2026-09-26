import {
  BookOpen,
  ChartLine,
  Github,
  SquareMenu,
  SquareTerminal,
  X,
} from "lucide-react";
import type { MouseEvent } from "react";

import { apiLinks } from "./rates-api-content";

const menuId = "mobile-nav-menu";

// Same-page anchors don't unload the page, so close the popover ourselves.
function closeMenu(event: MouseEvent<HTMLAnchorElement>) {
  event.currentTarget.closest<HTMLElement>("[popover]")?.hidePopover();
}

// Mirrors the floating "Menu" tab bar on simonbetton.com. The native popover
// API supplies light dismiss (outside click, Escape) and the expanded state;
// styles.css keys every open-state style off `:popover-open`.
export function MobileNav() {
  return (
    <div className="mobile-nav">
      <div aria-hidden="true" className="mobile-nav-fade">
        <div />
      </div>
      <nav aria-label="Mobile navigation" className="mobile-nav-bar">
        <button
          className="mobile-nav-trigger"
          popoverTarget={menuId}
          type="button"
        >
          <span aria-hidden="true" className="mobile-nav-icon">
            <SquareMenu className="mobile-nav-icon-menu" />
            <X className="mobile-nav-icon-close" />
          </span>
          Menu
        </button>
        <div className="mobile-nav-menu" id={menuId} popover="auto">
          <div className="mobile-nav-links">
            <a href="#explorer" onClick={closeMenu}>
              <ChartLine aria-hidden="true" />
              Explore
            </a>
            <a href={apiLinks.docs} onClick={closeMenu}>
              <BookOpen aria-hidden="true" />
              Docs
            </a>
            <a href={apiLinks.source} onClick={closeMenu}>
              <Github aria-hidden="true" />
              GitHub
            </a>
            <a
              className="mobile-nav-primary"
              href="#quickstart"
              onClick={closeMenu}
            >
              <SquareTerminal aria-hidden="true" />
              Try the API
            </a>
          </div>
        </div>
      </nav>
    </div>
  );
}
