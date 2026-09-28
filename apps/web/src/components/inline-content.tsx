import { Fragment } from "react";

import type { Inline } from "../lib/page-content";

export function partLabel(part: Inline) {
  if (typeof part === "string") {
    return part;
  }
  return "code" in part ? part.code : `${part.text} ${part.href}`;
}

// Keys from the content itself; a repeated item gets a counter.
export function keyed<T>(items: T[], label: (item: T) => string) {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = label(item);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return { item, key: count === 0 ? base : `${base} ${count}` };
  });
}

/** Text with inline code and links, as the text pages and FAQs use it. */
export function InlineContent({ content }: { content: Inline[] }) {
  return keyed(content, partLabel).map(({ item: part, key }) => {
    if (typeof part === "string") {
      return <Fragment key={key}>{part}</Fragment>;
    }
    if ("code" in part) {
      return <code key={key}>{part.code}</code>;
    }
    return (
      <a href={part.href} key={key}>
        {part.text}
      </a>
    );
  });
}
