import { Terminal } from "lucide-react";

import { formatDay } from "../lib/key-facts";
import type { Block, ContentPage } from "../lib/page-content";
import { InlineContent, keyed, partLabel } from "./inline-content";
import { SiteFooter } from "./static-sections";

function blockLabel(block: Block) {
  switch (block.kind) {
    case "heading": {
      return block.text;
    }
    case "paragraph": {
      return block.content.map(partLabel).join("");
    }
    default: {
      return block.items.flat().map(partLabel).join("");
    }
  }
}

function ContentBlock({ block }: { block: Block }) {
  switch (block.kind) {
    case "heading": {
      return <h2>{block.text}</h2>;
    }
    case "paragraph": {
      return (
        <p>
          <InlineContent content={block.content} />
        </p>
      );
    }
    default: {
      return (
        <ul>
          {keyed(block.items, (item) => item.map(partLabel).join("")).map(
            ({ item, key }) => (
              <li key={key}>
                <InlineContent content={item} />
              </li>
            )
          )}
        </ul>
      );
    }
  }
}

// The layout of the 404 page: the logo, the text, then the site footer.
export function ContentPageView({ page }: { page: ContentPage }) {
  return (
    <div id="rates-home">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <main className="page-container py-16" id="main-content" tabIndex={-1}>
        <a className="site-logo" href="/" aria-label="Rates API home">
          <Terminal size={24} aria-hidden="true" />
          <span>Rates API</span>
        </a>
        <article className="content-page">
          <p className="eyebrow mt-16">{page.eyebrow}</p>
          <h1>{page.title}</h1>
          <p className="content-page-lede">
            <InlineContent content={page.lede} />
          </p>
          {keyed(page.blocks, blockLabel).map(({ item, key }) => (
            <ContentBlock block={item} key={key} />
          ))}
          {page.updated && (
            <p className="content-page-updated">
              Last updated{" "}
              <time dateTime={page.updated}>{formatDay(page.updated)}</time>
            </p>
          )}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
