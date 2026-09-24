// Parses scraped numeric cell text into a number, preserving genuine zero.
//
// `parseFloat(text) || null` treats 0 as falsy and collapses it to null,
// which is wrong: a $0 fee or 0% rate is a real value, not an absent one.
// This helper only returns null when the text is blank or unparsable.
export function parseOptionalNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }

  const parsed = Number.parseFloat(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}
