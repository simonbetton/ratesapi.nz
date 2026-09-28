// Text pages (about, contact, privacy) are written once as data. The page
// component renders them as HTML, and the Worker renders the same data as
// Markdown for agents, so the two never disagree.

import { formatDay } from "./key-facts";
import { siteOrigin } from "./site-urls";

/** Inline text: plain text, inline code, or a link. */
export type Inline = string | { code: string } | { text: string; href: string };

export type Block =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; content: Inline[] }
  | { kind: "list"; items: Inline[][] };

export interface ContentPage {
  path: `/${string}`;
  /** The schema.org type of the page, for its JSON-LD. */
  schemaType: "AboutPage" | "ContactPage" | "WebPage";
  /** The page's <title> and h1. */
  title: string;
  eyebrow: string;
  /** The meta description, also the summary under the Markdown title. */
  description: string;
  lede: Inline[];
  blocks: Block[];
  /** The day (YYYY-MM-DD) of the last change to the text, if the page shows it. */
  updated?: string;
}

/** The URL of a page on this site, or the link itself if it is external. */
export function absoluteUrl(href: string) {
  return href.startsWith("/") ? `${siteOrigin}${href}` : href;
}

// Only the characters that change the meaning of Markdown text are escaped.
function escapeMarkdown(text: string) {
  return text.replaceAll(/[\\`*_[\]<>]/gu, String.raw`\$&`);
}

export function inlineMarkdown(content: Inline[]) {
  return content
    .map((part) => {
      if (typeof part === "string") {
        return escapeMarkdown(part);
      }
      if ("code" in part) {
        return `\`${part.code}\``;
      }
      return `[${escapeMarkdown(part.text)}](${absoluteUrl(part.href)})`;
    })
    .join("");
}

function blockMarkdown(block: Block) {
  switch (block.kind) {
    case "heading": {
      return `## ${escapeMarkdown(block.text)}`;
    }
    case "paragraph": {
      return inlineMarkdown(block.content);
    }
    case "list": {
      return block.items.map((item) => `- ${inlineMarkdown(item)}`).join("\n");
    }
    default: {
      const unknown: never = block;
      throw new Error(`Unknown block: ${JSON.stringify(unknown)}`);
    }
  }
}

/** The whole page as Markdown: the content only, without site navigation. */
export function pageMarkdown(page: ContentPage) {
  return [
    `# ${escapeMarkdown(page.title)}`,
    `> ${escapeMarkdown(page.description)}`,
    inlineMarkdown(page.lede),
    ...page.blocks.map(blockMarkdown),
    ...(page.updated ? [`Last updated: ${formatDay(page.updated)}`] : []),
  ]
    .join("\n\n")
    .concat("\n");
}
