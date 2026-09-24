import { type SupportedModels } from "../src/lib/data-loader";

/**
 * Guards against persisting a scrape that produced no usable data.
 *
 * The upstream page can return HTTP 200 with an empty or restructured rate
 * table, which would otherwise still satisfy schema validation as an empty
 * (but structurally valid) dataset. Persisting that would look like a
 * legitimate "no rates" change and can wipe out the latest data and that
 * day's history. Call this before comparing against existing data or writing
 * to D1, so a broken scrape never reaches persistence.
 *
 * The required invariant is at least one usable rate/plan in the whole
 * snapshot: an institution/issuer with an empty products/plans list, or a
 * product with an empty rates list, does not by itself fail the scrape as
 * long as some other institution/product in the same snapshot has data.
 *
 * Independent of fetch, Wrangler, and process exit so it can run in tests.
 */
export function assertScrapeHasRates(model: SupportedModels): void {
  if (model.data.length === 0) {
    throw new Error(`${model.type}: scrape returned no data`);
  }

  if (model.type === "CreditCardRates") {
    const hasAnyPlan = model.data.some((issuer) => issuer.plans.length > 0);
    if (!hasAnyPlan) {
      throw new Error(`${model.type}: no issuer has any plans`);
    }
    return;
  }

  const hasAnyProduct = model.data.some(
    (institution) => institution.products.length > 0,
  );
  if (!hasAnyProduct) {
    throw new Error(`${model.type}: no institution has any products`);
  }

  const hasAnyRate = model.data.some((institution) =>
    institution.products.some((product) => product.rates.length > 0),
  );
  if (!hasAnyRate) {
    throw new Error(`${model.type}: no product has any rates`);
  }
}

/**
 * Guards against a missing or restructured rate table producing zero rows.
 * Throwing here makes a missing table distinguishable in logs from a table
 * that was present but parsed down to empty data.
 */
export function assertTableHasRows(
  rowCount: number,
  tableSelector: string,
): void {
  if (rowCount === 0) {
    throw new Error(
      `No rows found for selector "${tableSelector}"; the page layout may have changed`,
    );
  }
}
