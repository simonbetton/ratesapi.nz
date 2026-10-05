import { load } from "cheerio";

import { page, requireCount } from "./parsing";

/** Resolve an exact, currently linked disclosure, not an unlinked historical file. */
export function documentLink(
  pages: ReadonlyMap<string, string>,
  index: string,
  pattern: RegExp
): string {
  const $ = load(page(pages, index));
  const base = new URL($("base[href]").first().attr("href") ?? index, index);
  const urls = new Set(
    $("a[href]")
      .toArray()
      .filter((link) =>
        pattern.test(`${$(link).text()} ${$(link).attr("href")}`)
      )
      .map((link) => new URL($(link).attr("href") ?? "", base).href)
  );
  const [url] = requireCount([...urls], 1);
  if (!url) {
    throw new Error("Disclosure link missing");
  }
  return url;
}

export function pdfText(
  pages: ReadonlyMap<string, string>,
  url: string
): string {
  const data: unknown = JSON.parse(page(pages, url));
  if (
    !data ||
    typeof data !== "object" ||
    !("type" in data) ||
    data.type !== "pdf" ||
    !("text" in data) ||
    typeof data.text !== "string"
  ) {
    throw new Error("Expected extracted first-party PDF text");
  }
  return data.text.replaceAll(/\s+/gu, " ").trim();
}
