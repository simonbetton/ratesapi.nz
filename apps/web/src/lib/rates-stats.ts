import type { Category, HistorySnapshot, RateRow } from "./rates-data";
import { mortgageTerms, termSortValue } from "./rates-data";

export interface RateFilters {
  query: string;
  /** Mortgage term label, e.g. "1 year". Empty means every term. */
  term: string;
  /** Loan plan, e.g. "Secured". Empty means every plan. */
  plan: string;
  specialsOnly: boolean;
  balanceTransferOnly: boolean;
}

export function hasValue<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function defaultFilters(category: Category): RateFilters {
  return {
    query: "",
    term: category === "mortgage" ? "1 year" : "",
    plan: "",
    specialsOnly: false,
    balanceTransferOnly: false,
  };
}

export function filterRows(rows: readonly RateRow[], filters: RateFilters) {
  const query = filters.query.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (!query ||
        `${row.provider} ${row.product}`.toLowerCase().includes(query)) &&
      (!filters.term || row.term === filters.term) &&
      (!filters.plan || row.plan === filters.plan) &&
      (!filters.specialsOnly || /special/iu.test(row.product)) &&
      (!filters.balanceTransferOnly || hasValue(row.balanceTransferRate))
  );
}

function ratesOf(rows: readonly RateRow[]) {
  return rows.map((row) => row.rate).filter(hasValue);
}

export function median(values: readonly number[]) {
  if (values.length === 0) {
    return null;
  }
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? upper) + upper) / 2
    : upper;
}

export function summarize(rows: readonly RateRow[]) {
  let lowest: RateRow | null = null;
  let lowestRate = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    if (hasValue(row.rate) && row.rate < lowestRate) {
      lowest = row;
      lowestRate = row.rate;
    }
  }
  return {
    lowest,
    median: median(ratesOf(rows)),
    providers: new Set(rows.map((row) => row.provider)).size,
  };
}

/** Keys of the rows holding the lowest value in their group. Ties share it. */
export function lowestKeys(
  rows: readonly RateRow[],
  valueOf: (row: RateRow) => number | null | undefined,
  groupOf: (row: RateRow) => string = (row) => row.group
) {
  const lowestByGroup = new Map<string, number>();
  for (const row of rows) {
    const value = valueOf(row);
    const current = lowestByGroup.get(groupOf(row));
    if (hasValue(value) && (current === undefined || value < current)) {
      lowestByGroup.set(groupOf(row), value);
    }
  }
  return new Set(
    rows
      .filter((row) => {
        const value = valueOf(row);
        return hasValue(value) && value === lowestByGroup.get(groupOf(row));
      })
      .map((row) => row.key)
  );
}

export type SortKey =
  | "provider"
  | "product"
  | "term"
  | "plan"
  | "condition"
  | "rate"
  | "cashAdvanceRate"
  | "balanceTransferRate"
  | "interestFreeDays"
  | "fee";

export interface SortState {
  key: SortKey;
  direction: "asc" | "desc";
}

function sortValue(row: RateRow, key: SortKey): string | number | null {
  if (key === "term") {
    return termSortValue(row);
  }
  return row[key] ?? null;
}

/** Sorts by the chosen column. Missing values always sort last. */
export function sortRows(rows: readonly RateRow[], sort: SortState) {
  const sign = sort.direction === "asc" ? 1 : -1;
  return rows.toSorted((a, b) => {
    const left = sortValue(a, sort.key);
    const right = sortValue(b, sort.key);
    if (left === null || right === null) {
      return (left === null ? 1 : 0) - (right === null ? 1 : 0);
    }
    const order =
      typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right));
    return (
      order * sign ||
      a.provider.localeCompare(b.provider) ||
      (a.rate ?? 0) - (b.rate ?? 0)
    );
  });
}

/** Each provider's lowest-rate row, cheapest first. */
export function providerRanking(rows: readonly RateRow[], limit: number) {
  const best = new Map<string, RateRow>();
  for (const row of rows) {
    const current = best.get(row.provider);
    if (
      hasValue(row.rate) &&
      (!hasValue(current?.rate) || row.rate < current.rate)
    ) {
      best.set(row.provider, row);
    }
  }
  return [...best.values()]
    .toSorted((a, b) => (a.rate ?? 0) - (b.rate ?? 0))
    .slice(0, limit);
}

/** Lowest and median rate for each mortgage term, floating first. */
export function termCurve(rows: readonly RateRow[]) {
  return mortgageTerms.map(({ term, short }) => {
    const rates = ratesOf(rows.filter((row) => row.term === term));
    return {
      term,
      short,
      lowest: rates.length > 0 ? Math.min(...rates) : null,
      median: median(rates),
    };
  });
}

/** Lowest and median rate in each snapshot, after applying the filters. */
export function historySeries(
  snapshots: readonly HistorySnapshot[],
  filters: RateFilters
) {
  return snapshots.map(({ date, rows }) => {
    const rates = ratesOf(filterRows(rows, filters));
    return {
      date,
      lowest: rates.length > 0 ? Math.min(...rates) : null,
      median: median(rates),
    };
  });
}

export function formatRate(value: number) {
  return `${value.toFixed(2)}%`;
}
