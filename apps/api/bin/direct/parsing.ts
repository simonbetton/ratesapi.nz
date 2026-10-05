import { load } from "cheerio";
import type { CheerioAPI } from "cheerio";

import type { Observation } from "./types";

export function plainText(html: string): string {
  const $ = load(html);
  $("script, style, nav, header, footer, noscript, sup").remove();
  return $("body").text().replaceAll(/\s+/gu, " ").trim();
}

/** Never parseFloat arbitrary prose, a range, a fee, or a missing-rate placeholder. */
export function percentage(text: string): number {
  const match =
    /^\s*(?<value>\d+(?:\.\d+)?)\s*(?:%\s*(?:p\.?\s*a\.?)?)?\s*\*?\s*$/iu.exec(
      text
    );
  if (!match) {
    throw new Error(
      `Expected one percentage, received ${JSON.stringify(text)}`
    );
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`Percentage out of range: ${text}`);
  }
  return value;
}

export function advertisedRate(
  text: string
): Pick<Observation, "rate" | "rateMaximum" | "rateType"> {
  const match =
    /^(?:from\s+)?(?<value>\d+(?:\.\d+)?)\s*%?\s*(?:p\.?\s*a\.?)?\s*(?:to|[-–])\s*(?<maximum>\d+(?:\.\d+)?)\s*%\s*(?:p\.?\s*a\.?)?\s*\*?$/iu.exec(
      text.trim()
    );
  if (match) {
    const rate = percentage(match[1] ?? "");
    const rateMaximum = percentage(match[2] ?? "");
    if (rateMaximum < rate) {
      throw new Error(`Inverted rate range: ${text}`);
    }
    return { rate, rateMaximum, rateType: "range" };
  }
  const from = /^from\s+/iu.test(text);
  return {
    rate: percentage(text.replace(/^from\s+/iu, "")),
    rateType: from ? "from" : "advertised",
  };
}

export function tableRows($: CheerioAPI, selector: string): string[][] {
  const tables = $(selector);
  if (tables.length !== 1) {
    throw new Error(
      `Expected one rate table for ${selector}, found ${tables.length}`
    );
  }
  return tables
    .find("tr")
    .toArray()
    .map((row) =>
      $(row)
        .find("th, td")
        .toArray()
        .map((cell) => {
          const copy = $(cell).clone();
          copy.find("sup").remove();
          return copy.text().replaceAll(/\s+/gu, " ").trim();
        })
    );
}

export function termMonths(text: string): number | null {
  if (/^(?:variable|floating)(?: rate)?\*?$/iu.test(text)) {
    return null;
  }
  const match =
    /^(?<value>6|12|18|24|36|48|60)\s*months?(?: fixed)?$/iu.exec(text) ??
    /^(?<value>1|2|3|4|5)\s*years?(?: fixed)?$/iu.exec(text);
  if (!match) {
    throw new Error(`Unrecognised mortgage term: ${text}`);
  }
  return Number(match[1]) * (/year/iu.test(text) ? 12 : 1);
}

export function requiredMatch(text: string, pattern: RegExp): RegExpExecArray {
  const matches = [
    ...text.matchAll(
      new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`)
    ),
  ];
  if (matches.length !== 1) {
    throw new Error(
      `Expected one match for ${pattern}, found ${matches.length}`
    );
  }
  const [match] = matches;
  if (!match) {
    throw new Error(`No match for ${pattern}`);
  }
  return match;
}

export function page(pages: ReadonlyMap<string, string>, url: string): string {
  const html = pages.get(url);
  if (!html) {
    throw new Error(`Missing response for ${url}`);
  }
  return html;
}

export function matchingTable(html: string, pattern: RegExp): string[][] {
  const $ = load(html);
  const matches = $("table")
    .toArray()
    .filter((table) =>
      pattern.test($(table).text().replaceAll(/\s+/gu, " ").trim())
    );
  if (matches.length !== 1) {
    throw new Error(
      `Expected one table matching ${pattern}, found ${matches.length}`
    );
  }
  return tableRows(load($.html(matches[0])), "table");
}

export function requireCount<T>(items: T[], expected: number): T[] {
  if (items.length !== expected) {
    throw new Error(
      `Expected ${expected} rate rows, found ${items.length}; review source coverage`
    );
  }
  return items;
}
