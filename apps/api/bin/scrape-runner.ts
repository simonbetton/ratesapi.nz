/**
 * Pure orchestration boundary for the scheduled scraper entrypoints.
 *
 * Each entrypoint injects its own D1 loader, upstream fetcher, parser
 * (including Plan 002's guards), change comparison, and D1 saver. This
 * module owns only the control flow so it can be unit tested without any
 * network or D1 access:
 *
 *  - A `loadCurrent` rejection is treated as "no previous data" (`null`)
 *    rather than failing the run — this preserves the existing behavior
 *    where a failed load still allows a fresh scrape to be saved.
 *  - `hasChanged` is only consulted when current data is non-null.
 *  - A `fetchHtml` or `parseAndValidate` rejection propagates to the
 *    caller, which should exit the process non-zero.
 *  - `save` is called exactly once for changed data, and never for
 *    unchanged data. If `save` resolves `false`, the runner throws so the
 *    caller can exit the process non-zero.
 */

export type ScrapeOutcome = { status: "saved" } | { status: "unchanged" };

export interface RunScrapeOptions<TData> {
  /** Loads the currently persisted data. A rejection is treated as `null`. */
  loadCurrent: () => Promise<TData | null>;
  /** Fetches the raw upstream HTML. A rejection propagates. */
  fetchHtml: () => Promise<string>;
  /** Parses and validates the scrape, including any guard checks. A rejection propagates. */
  parseAndValidate: (html: string) => Promise<TData> | TData;
  /** Compares freshly scraped data against the currently persisted data. */
  hasChanged: (newData: TData, oldData: TData) => boolean;
  /** Persists the scraped data. Resolving `false` is treated as a failure. */
  save: (data: TData) => Promise<boolean>;
}

export async function runScrape<TData>(
  options: RunScrapeOptions<TData>
): Promise<ScrapeOutcome> {
  let currentData: TData | null = null;
  try {
    currentData = await options.loadCurrent();
  } catch {
    currentData = null;
  }

  const html = await options.fetchHtml();
  const validatedData = await options.parseAndValidate(html);

  if (currentData !== null && !options.hasChanged(validatedData, currentData)) {
    return { status: "unchanged" };
  }

  const saved = await options.save(validatedData);
  if (!saved) {
    throw new Error("Failed to save scraped data");
  }

  return { status: "saved" };
}
