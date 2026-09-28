// Chooses the representation of a page from the request's Accept header: HTML
// for browsers, Markdown for agents that ask for it. The rules follow RFC 9110
// (section 12.5.1) and https://acceptmarkdown.com/guides/accept-parsing:
//
// - The media range with the highest q-value wins.
// - On a tie, a client that names text/markdown gets Markdown. Browsers never
//   name it, and agents such as Claude Code send "text/markdown, text/html".
//   Otherwise (text/*, */*) HTML is the default.
// - q=0 excludes a type. A header of only exclusions (text/markdown;q=0) means
//   "anything else", so the other type is sent.
// - No Accept header, or one without a usable range, means no preference.

export type Representation = "html" | "markdown";

export interface MediaRange {
  type: string;
  subtype: string;
  q: number;
}

interface Match {
  q: number;
  specificity: number;
}

// RFC 9110 qvalue: 0 to 1 with at most three decimals.
const qValuePattern = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/u;

function parseMediaRange(entry: string): MediaRange | null {
  const [range = "", ...parameters] = entry
    .split(";")
    .map((part) => part.trim());
  const [type, subtype, ...extra] = range.toLowerCase().split("/");
  if (
    !type ||
    !subtype ||
    extra.length > 0 ||
    (type === "*" && subtype !== "*")
  ) {
    return null;
  }

  const weight = parameters.find((parameter) =>
    parameter.toLowerCase().startsWith("q=")
  );
  if (weight === undefined) {
    return { type, subtype, q: 1 };
  }

  const value = weight.slice(2).trim();
  return qValuePattern.test(value) ? { type, subtype, q: Number(value) } : null;
}

/** The media ranges of an Accept header. Ranges it cannot read are left out. */
export function parseAccept(header: string): MediaRange[] {
  return header.split(",").flatMap((entry) => {
    const range = parseMediaRange(entry);
    return range ? [range] : [];
  });
}

const exactMatch = 2;

// 2 for type/subtype, 1 for type/*, 0 for */*, and -1 for no match.
function specificity(range: MediaRange, type: string, subtype: string) {
  if (range.type === "*") {
    return 0;
  }
  if (range.type !== type) {
    return -1;
  }
  if (range.subtype === subtype) {
    return exactMatch;
  }
  return range.subtype === "*" ? 1 : -1;
}

// The most specific range that matches a type sets its q-value.
function bestMatch(ranges: MediaRange[], type: string, subtype: string) {
  let best: Match | null = null;
  for (const range of ranges) {
    const level = specificity(range, type, subtype);
    const isBetter =
      best === null ||
      level > best.specificity ||
      (level === best.specificity && range.q > best.q);
    if (level >= 0 && isBetter) {
      best = { q: range.q, specificity: level };
    }
  }
  return best;
}

/**
 * The representation to send, or null when the client accepts neither HTML
 * nor Markdown (the response is then 406 Not Acceptable).
 */
export function negotiate(accept: string | null): Representation | null {
  const ranges = parseAccept(accept ?? "");
  if (ranges.length === 0) {
    return "html";
  }

  const html = bestMatch(ranges, "text", "html");
  const markdown = bestMatch(ranges, "text", "markdown");
  if (!html?.q && !markdown?.q) {
    return withoutAcceptedType(ranges, html, markdown);
  }
  return preferred(html, markdown);
}

// Neither type has a q-value above 0. A client that only excludes types
// accepts the other one; a client that wants another type gets nothing.
function withoutAcceptedType(
  ranges: MediaRange[],
  html: Match | null,
  markdown: Match | null
): Representation | null {
  if (ranges.some((range) => range.q > 0)) {
    return null;
  }
  if (html === null) {
    return "html";
  }
  return markdown === null ? "markdown" : null;
}

// The higher q-value wins. On a tie, Markdown wins only if the client names
// it: a wildcard matches both types equally, and then HTML is the default.
function preferred(html: Match | null, markdown: Match | null): Representation {
  const htmlQ = html?.q ?? 0;
  const markdownQ = markdown?.q ?? 0;
  if (htmlQ !== markdownQ) {
    return markdownQ > htmlQ ? "markdown" : "html";
  }
  return markdown?.specificity === exactMatch ? "markdown" : "html";
}

/** True when the client accepts the media type with a q-value above 0. */
export function accepts(accept: string | null, type: string, subtype: string) {
  return (bestMatch(parseAccept(accept ?? ""), type, subtype)?.q ?? 0) > 0;
}
