// The homepage's "Key facts": live coverage numbers, rendered on the server so
// search engines and assistants can quote them. Everything here is pure; the
// Worker-only lookup and caching live in key-facts.server.ts.

export interface KeyFacts {
  mortgageLenders: number;
  personalLoanLenders: number;
  carLoanLenders: number;
  creditCardIssuers: number;
  /** The newest `lastUpdated` across the four datasets (ISO 8601). */
  lastUpdated: string;
  /** The first day with a stored mortgage snapshot (YYYY-MM-DD). */
  historyStart: string;
}

/** The part of a Workers service binding (or `globalThis`) this reads. */
export interface RatesApiFetcher {
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
}

// A service binding ignores the host; the API routes on the path alone.
const apiOrigin = "https://www.ratesapi.nz";
const latestPaths = [
  ["/api/v1/mortgage-rates", "MortgageRates"],
  ["/api/v1/personal-loan-rates", "PersonalLoanRates"],
  ["/api/v1/car-loan-rates", "CarLoanRates"],
  ["/api/v1/credit-card-rates", "CreditCardRates"],
] as const;
// With no dates, the time series lists every day it has a snapshot for.
const historyPath = "/api/v1/mortgage-rates/time-series";
const isoDay = /^\d{4}-\d{2}-\d{2}$/u;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

/** The provider count and update time of one latest-rates payload. */
function readLatest(value: unknown, payloadType: string) {
  const record = asRecord(value);
  const updated =
    typeof record?.lastUpdated === "string"
      ? Date.parse(record.lastUpdated)
      : Number.NaN;
  if (
    record?.type !== payloadType ||
    !Array.isArray(record.data) ||
    record.data.length === 0 ||
    Number.isNaN(updated)
  ) {
    return null;
  }
  return { count: record.data.length, updated };
}

function readHistoryStart(value: unknown) {
  const dates = asRecord(value)?.availableDates;
  if (!Array.isArray(dates)) {
    return null;
  }
  const days = dates.filter(
    (date): date is string => typeof date === "string" && isoDay.test(date)
  );
  return days.length > 0 ? days.toSorted()[0] : null;
}

function rejectOnAbort(signal: AbortSignal) {
  // oxlint-disable-next-line promise/avoid-new -- turns the abort event into a promise to race
  return new Promise<never>((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), {
      once: true,
    });
  });
}

async function readJson(
  api: RatesApiFetcher,
  path: string,
  signal: AbortSignal
): Promise<unknown> {
  const response = await api.fetch(`${apiOrigin}${path}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Rates API returned HTTP ${response.status} for ${path}`);
  }
  return response.json();
}

/**
 * Reads the key facts from the API, or returns null if any request fails,
 * returns something unexpected, or takes longer than `timeoutMs` in total.
 */
export async function fetchKeyFacts(
  api: RatesApiFetcher,
  timeoutMs = 2500
): Promise<KeyFacts | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const paths = [...latestPaths.map(([path]) => path), historyPath];
    // Racing the abort keeps the time limit even if a fetcher ignores signals.
    const payloads = await Promise.race([
      Promise.all(paths.map((path) => readJson(api, path, controller.signal))),
      rejectOnAbort(controller.signal),
    ]);

    const [mortgage, personalLoan, carLoan, creditCard] = latestPaths.map(
      ([, payloadType], index) => readLatest(payloads[index], payloadType)
    );
    const historyStart = readHistoryStart(payloads[latestPaths.length]);
    if (
      !mortgage ||
      !personalLoan ||
      !carLoan ||
      !creditCard ||
      !historyStart
    ) {
      return null;
    }
    const lastUpdated = Math.max(
      mortgage.updated,
      personalLoan.updated,
      carLoan.updated,
      creditCard.updated
    );
    return {
      mortgageLenders: mortgage.count,
      personalLoanLenders: personalLoan.count,
      carLoanLenders: carLoan.count,
      creditCardIssuers: creditCard.count,
      lastUpdated: new Date(lastUpdated).toISOString(),
      historyStart,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const dayFormat = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Formats a YYYY-MM-DD day the New Zealand way, e.g. "8 March 2025". */
export function formatDay(day: string) {
  return dayFormat.format(new Date(`${day}T00:00:00Z`));
}

/**
 * One quotable paragraph. Without live facts it falls back to wording that
 * stays true as lenders come and go.
 */
export function keyFactsSummary(facts: KeyFacts | null) {
  if (!facts) {
    return "Rates API is a free JSON API for New Zealand lending rates. It covers mortgages, personal loans, car loans and credit cards from 30+ lenders and card issuers. It checks interest.co.nz every hour, keeps a daily history of every dataset, and needs no account or API key.";
  }
  return `Rates API is a free JSON API for New Zealand lending rates. It covers ${facts.mortgageLenders} mortgage lenders, ${facts.personalLoanLenders} personal loan lenders, ${facts.carLoanLenders} car loan lenders and ${facts.creditCardIssuers} credit card issuers. It checks interest.co.nz every hour, has kept a daily history since ${formatDay(facts.historyStart)}, and needs no account or API key.`;
}

/** Small stat items to sit beside the summary. */
export function keyFactStats(facts: KeyFacts) {
  return [
    { label: "Mortgage lenders", value: facts.mortgageLenders },
    { label: "Personal loan lenders", value: facts.personalLoanLenders },
    { label: "Car loan lenders", value: facts.carLoanLenders },
    { label: "Credit card issuers", value: facts.creditCardIssuers },
  ];
}
