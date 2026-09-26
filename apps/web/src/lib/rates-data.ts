import { apiUrl } from "./site-urls";

export type Category =
  | "mortgage"
  | "personal-loan"
  | "car-loan"
  | "credit-card";

interface CategoryInfo {
  id: Category;
  label: string;
  path: string;
  payloadType: string;
}

export const categories: readonly CategoryInfo[] = [
  {
    id: "mortgage",
    label: "Mortgages",
    path: "/api/v1/mortgage-rates",
    payloadType: "MortgageRates",
  },
  {
    id: "personal-loan",
    label: "Personal loans",
    path: "/api/v1/personal-loan-rates",
    payloadType: "PersonalLoanRates",
  },
  {
    id: "car-loan",
    label: "Car loans",
    path: "/api/v1/car-loan-rates",
    payloadType: "CarLoanRates",
  },
  {
    id: "credit-card",
    label: "Credit cards",
    path: "/api/v1/credit-card-rates",
    payloadType: "CreditCardRates",
  },
];

export function categoryInfo(category: Category): CategoryInfo {
  const info = categories.find((item) => item.id === category);
  if (!info) {
    throw new Error(`Unknown rates category: ${category}`);
  }
  return info;
}

/** One table row, flattened from any of the four API families. */
export interface RateRow {
  key: string;
  /** The API's institution or issuer ID, e.g. "institution:anz". */
  providerId: string;
  provider: string;
  product: string;
  /** Headline rate for stats, charts, and the default sort: the mortgage or
   * loan rate, or a card's purchase rate. */
  rate: number | null;
  /** Rows compete for the "lowest" badge within their group. */
  group: string;
  term?: string;
  termInMonths?: number | null;
  plan?: string | null;
  condition?: string | null;
  cashAdvanceRate?: number | null;
  balanceTransferRate?: number | null;
  balanceTransferPeriod?: string | null;
  interestFreeDays?: number | null;
  fee?: number | null;
}

export interface RatesSnapshot {
  rows: RateRow[];
  lastUpdated: string;
}

export interface HistorySnapshot {
  date: string;
  rows: RateRow[];
}

export type Loaded<T> =
  | { status: "success"; value: T }
  | { status: "error"; message: string };

// The API's JSON, typed only as far as the explorer reads it.
interface ApiRate {
  id: string;
  rate: number;
  term?: string;
  termInMonths?: number | null;
  plan?: string | null;
  condition?: string | null;
}

interface ApiProduct {
  id: string;
  name: string;
  rates: ApiRate[];
}

interface ApiPlan {
  id: string;
  name: string;
  interestFreePeriodInMonths: number | null;
  primaryFeeNZD: number | null;
  balanceTransferRate: number | null;
  balanceTransferPeriod: string | null;
  cashAdvanceRate: number | null;
  purchaseRate: number | null;
}

interface ApiProvider {
  id: string;
  name: string;
  products?: ApiProduct[];
  plans?: ApiPlan[];
}

export interface ApiRates {
  type: string;
  data: ApiProvider[];
  lastUpdated: string;
}

function isApiRates(value: unknown, payloadType: string): value is ApiRates {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.type === payloadType &&
    Array.isArray(record.data) &&
    typeof record.lastUpdated === "string"
  );
}

const mortgageTermOrder = [
  "Variable floating",
  "6 months",
  "1 year",
  "18 months",
  "2 years",
  "3 years",
  "4 years",
  "5 years",
] as const;

export const mortgageTerms = mortgageTermOrder.map((term) => ({
  term,
  short: term === "Variable floating" ? "Float" : shortTerm(term),
}));

function shortTerm(term: string) {
  const [count, unit] = term.split(" ");
  return `${count}${unit?.startsWith("year") ? "y" : "m"}`;
}

/** Floating first, then fixed terms from shortest to longest. */
export function termSortValue(row: RateRow) {
  return row.termInMonths ?? 0;
}

export function toRows(category: Category, payload: ApiRates): RateRow[] {
  // Row keys include the position: a few upstream IDs repeat within a payload.
  let index = 0;
  const nextKey = (id: string) => {
    index += 1;
    return `${id}#${index}`;
  };

  if (category === "credit-card") {
    return payload.data.flatMap((issuer) =>
      (issuer.plans ?? [])
        // Debit, prepaid, and charge cards are listed with a 0% purchase rate.
        // They are not credit, and would always show as the cheapest card.
        .filter((plan) => plan.purchaseRate !== 0)
        .map((plan) => ({
          key: nextKey(plan.id),
          providerId: issuer.id,
          provider: issuer.name,
          product: plan.name,
          rate: plan.purchaseRate,
          group: "Purchase rate",
          cashAdvanceRate: plan.cashAdvanceRate,
          balanceTransferRate: plan.balanceTransferRate,
          balanceTransferPeriod: plan.balanceTransferPeriod,
          // The API names this field in months, but the value is in days.
          interestFreeDays: plan.interestFreePeriodInMonths,
          fee: plan.primaryFeeNZD,
        }))
    );
  }

  return payload.data.flatMap((institution) =>
    (institution.products ?? []).flatMap((product) =>
      product.rates.map((rate) => {
        const row: RateRow = {
          key: nextKey(rate.id),
          providerId: institution.id,
          provider: institution.name,
          product: product.name,
          // No lender offers a 0% mortgage or loan; treat it as a source glitch.
          rate: rate.rate > 0 ? rate.rate : null,
          group: "",
        };
        if (category === "mortgage") {
          row.term = rate.term ?? "";
          row.termInMonths = rate.termInMonths ?? null;
          row.group = row.term;
        } else {
          row.plan = rate.plan ?? null;
          row.condition = rate.condition ?? null;
          row.group = rate.plan ?? "Other";
        }
        return row;
      })
    )
  );
}

async function fetchJson(url: string): Promise<Loaded<unknown>> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) {
      return {
        status: "error",
        message: `The API returned HTTP ${response.status}.`,
      };
    }
    return { status: "success", value: await response.json() };
  } catch {
    return {
      status: "error",
      message: "Could not reach the API. Check your connection and retry.",
    };
  }
}

async function fetchLatest(category: Category): Promise<Loaded<RatesSnapshot>> {
  const info = categoryInfo(category);
  const result = await fetchJson(apiUrl(info.path));
  if (result.status === "error") {
    return result;
  }
  if (!isApiRates(result.value, info.payloadType)) {
    return {
      status: "error",
      message: "The API response was not in the expected format.",
    };
  }
  return {
    status: "success",
    value: {
      rows: toRows(category, result.value),
      lastUpdated: result.value.lastUpdated,
    },
  };
}

interface TimeSeriesPayload {
  timeSeries: Record<string, unknown>;
  availableDates: string[];
}

function isTimeSeries(value: unknown): value is TimeSeriesPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.timeSeries === "object" &&
    record.timeSeries !== null &&
    Array.isArray(record.availableDates)
  );
}

async function fetchSnapshot(
  category: Category,
  date: string
): Promise<(HistorySnapshot & { availableDates: string[] }) | null> {
  const info = categoryInfo(category);
  const result = await fetchJson(
    apiUrl(`${info.path}/time-series?date=${date}`)
  );
  if (result.status === "error" || !isTimeSeries(result.value)) {
    return null;
  }
  const payload = result.value.timeSeries[date];
  if (!isApiRates(payload, info.payloadType)) {
    return null;
  }
  return {
    date,
    rows: toRows(category, payload),
    availableDates: result.value.availableDates,
  };
}

function shiftMonths(date: string, months: number) {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + months, day))
    .toISOString()
    .slice(0, 10);
}

/**
 * One point per month, going back from `latestDate`. The API only stores a
 * snapshot when rates change, so a month's rates are those of the newest
 * stored snapshot on or before it (which may be several months older).
 */
export function pickMonthlySnapshots(
  availableDates: readonly string[],
  latestDate: string,
  months: number
) {
  const sorted = availableDates.toSorted();
  const picks: { date: string; snapshot: string }[] = [];
  for (let offset = -months; offset < 0; offset += 1) {
    const date = shiftMonths(latestDate, offset);
    const snapshot = sorted.findLast((available) => available <= date);
    if (snapshot) {
      picks.push({ date, snapshot });
    }
  }
  return picks;
}

const historyMonths = 12;

// Samples monthly single-date snapshots instead of one long range request:
// each is a small, cheap read, while long ranges decode every stored day.
async function fetchHistory(
  category: Category,
  latestDate: string
): Promise<Loaded<HistorySnapshot[]>> {
  const latest = await fetchSnapshot(category, latestDate);
  if (!latest) {
    return { status: "error", message: "Rate history is unavailable." };
  }
  const picks = pickMonthlySnapshots(
    latest.availableDates,
    latestDate,
    historyMonths
  );
  const snapshotDates = [...new Set(picks.map((pick) => pick.snapshot))];
  const fetched = await Promise.all(
    snapshotDates.map((date) =>
      date === latestDate ? latest : fetchSnapshot(category, date)
    )
  );
  const rowsBySnapshot = new Map(
    fetched
      .filter((snapshot) => snapshot !== null)
      .map((snapshot) => [snapshot.date, snapshot.rows] as const)
  );
  const snapshots: HistorySnapshot[] = [];
  for (const { date, snapshot } of picks) {
    const rows = rowsBySnapshot.get(snapshot);
    if (rows) {
      snapshots.push({ date, rows });
    }
  }
  snapshots.push({ date: latestDate, rows: latest.rows });
  return { status: "success", value: snapshots };
}

// Promises are cached so React's `use()` sees a stable promise per request.
const latestCache = new Map<Category, Promise<Loaded<RatesSnapshot>>>();
const historyCache = new Map<string, Promise<Loaded<HistorySnapshot[]>>>();

export function loadLatest(category: Category) {
  let promise = latestCache.get(category);
  if (!promise) {
    promise = fetchLatest(category);
    latestCache.set(category, promise);
  }
  return promise;
}

export function loadHistory(category: Category, latestDate: string) {
  const key = `${category}:${latestDate}`;
  let promise = historyCache.get(key);
  if (!promise) {
    promise = fetchHistory(category, latestDate);
    historyCache.set(key, promise);
  }
  return promise;
}

export function forgetCategory(category: Category) {
  latestCache.delete(category);
  for (const key of historyCache.keys()) {
    if (key.startsWith(`${category}:`)) {
      historyCache.delete(key);
    }
  }
}
