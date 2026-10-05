import type { DataType } from "../../src/lib/data-loader";

export interface Observation {
  product: string;
  rate: number;
  sourceUrl: string;
  termInMonths?: number | null;
  /** Used when a lender publishes a fixed term range or leaves the term to agreement. */
  term?: string;
  plan?: string | null;
  condition?: string | null;
  rateMaximum?: number;
  rateType?: "advertised" | "from" | "range";
  cashAdvanceRate?: number | null;
  primaryFeeNZD?: number | null;
  interestFreePeriodInMonths?: number | null;
  balanceTransferRate?: number | null;
  balanceTransferPeriod?: string | null;
}

export interface DirectSource {
  id: string;
  institution: string;
  dataset: DataType;
  /** Only these first-party URLs may supply parser input; browsers also load page subresources. */
  urls: string[];
  /** Render these pages before parsing; HTTP-only feeds stay on the fast path. */
  browser?: Record<string, BrowserReadiness>;
  /** Current documents linked from the declared institution pages. */
  discover?: (pages: ReadonlyMap<string, string>) => string[];
  /** Reviewed institution-controlled document/CDN origins, in addition to urls' origins. */
  documentOrigins?: string[];
  parse: (pages: ReadonlyMap<string, string>) => Observation[];
}

export type BrowserReadiness = {
  /** Use the cloud host's default context and wait for its security interstitial to finish. */
  cloudChallenge?: boolean;
  /** Public feeds that must respond successfully before accepting rendered values. */
  requiredResponses?: string[];
} & (
  | { responseType: "json" }
  | {
      responseType?: "html";
      /** Count percentage elements in the published rate area; the parser validates their meaning. */
      selector: string;
      minimumRates: number;
    }
);

export interface CoverageEntry {
  status: "pending" | "active" | "excluded";
  reason: string;
  legacyProducts: string[];
  sourceUrl?: string;
  /** Exclusions require documented evidence and a recorded review date; rate values remain first-party only. */
  reviewedAt?: string;
  productDecisions?: Record<
    string,
    {
      /** Empty means the old product is excluded from current rates. */
      replacements: string[];
      reason: string;
      sourceUrl: string;
    }
  >;
}

export interface Institution {
  id: string;
  name: string;
  datasets: Partial<Record<DataType, CoverageEntry>>;
}
