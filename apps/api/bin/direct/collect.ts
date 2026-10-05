/* oxlint-disable no-await-in-loop -- Redirects, retry backoff, and bounded network workers are sequential. */
import { setTimeout as sleep } from "node:timers/promises";

import { extractText } from "unpdf";

import type { DataType, SupportedModels } from "../../src/lib/data-loader";
import { generateId } from "../../src/lib/generate-id";
import { parseSchema } from "../../src/lib/schema";
import { CarLoanRates } from "../../src/models/car-loan-rates";
import { CreditCardRates } from "../../src/models/credit-card-rates";
import { MortgageRates } from "../../src/models/mortgage-rates";
import { PersonalLoanRates } from "../../src/models/personal-loan-rates";
import { assertScrapeHasRates } from "../scrape-guards";
import type {
  BrowserReadiness,
  CoverageEntry,
  DirectSource,
  Institution,
  Observation,
} from "./types";

export const schemas = {
  "mortgage-rates": MortgageRates,
  "personal-loan-rates": PersonalLoanRates,
  "car-loan-rates": CarLoanRates,
  "credit-card-rates": CreditCardRates,
};

const modelTypes = {
  "mortgage-rates": "MortgageRates",
  "personal-loan-rates": "PersonalLoanRates",
  "car-loan-rates": "CarLoanRates",
  "credit-card-rates": "CreditCardRates",
};

export interface SourceResult {
  id: string;
  institution: string;
  urls: string[];
  status: "ok" | "failed";
  observations: number;
  error?: string;
}

export interface CollectionResult {
  dataset: DataType;
  checkedAt: string;
  sources: SourceResult[];
  blockers: string[];
  /** Null means publication is forbidden. Partial data is for inspection only. */
  model: SupportedModels | null;
  preview: SupportedModels | null;
}

export type FetchPage = (
  url: string,
  browserReadiness?: BrowserReadiness
) => Promise<string>;
type HttpFetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Share this fetcher for one collection run only, never between hourly runs. */
export function createSourceFetcher(fetcher: HttpFetch = fetch): FetchPage {
  const cache = new Map<string, Promise<string>>();
  return (url) => {
    let request = cache.get(url);
    if (!request) {
      request = fetchFirstParty(url, fetcher);
      cache.set(url, request);
    }
    return request;
  };
}

async function readSourceResponse(
  response: Response,
  target: string
): Promise<string> {
  if (response.headers.get("content-type")?.includes("application/pdf")) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (
      bytes.byteLength > 15_000_000 ||
      new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-"
    ) {
      throw new Error(`Invalid or oversized PDF at ${target}`);
    }
    const { text } = await extractText(bytes, { mergePages: true });
    if (!text.trim()) {
      throw new Error(`PDF has no extractable text at ${target}`);
    }
    return JSON.stringify({ type: "pdf", text });
  }
  const body = await response.text();
  if (!body.trim()) {
    throw new Error(`Empty response at ${target}`);
  }
  return body;
}

async function fetchFirstParty(
  url: string,
  fetcher: HttpFetch
): Promise<string> {
  const origin = new URL(url);
  if (origin.protocol !== "https:") {
    throw new Error(`Not an allowed first-party source: ${url}`);
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      let target = url;
      for (let redirect = 0; redirect < 5; redirect += 1) {
        const response = await fetcher(target, {
          redirect: "manual",
          signal: AbortSignal.timeout(25_000),
          headers: {
            "User-Agent": "RatesAPI/1.0 (+https://www.ratesapi.nz/contact)",
            Accept: "text/html, application/json, application/pdf",
          },
        });
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (!location) {
            throw new Error(`Redirect without a location at ${target}`);
          }
          const next = new URL(location, target);
          if (next.origin !== origin.origin) {
            throw new Error(
              `Unapproved source redirect: ${target} -> ${next.href}`
            );
          }
          target = next.href;
          continue;
        }
        if (!response.ok) {
          if (
            attempt === 0 &&
            (response.status === 429 || response.status >= 500)
          ) {
            break;
          }
          throw new Error(`HTTP ${response.status} at ${target}`);
        }
        return readSourceResponse(response, target);
      }
    } catch (error) {
      // Access denials and parser failures are not repaired by repeated requests.
      if (
        attempt === 1 ||
        !(error instanceof Error) ||
        !["TimeoutError", "AbortError", "TypeError"].includes(error.name)
      ) {
        throw error;
      }
    }
    await sleep(500);
  }
  throw new Error(`Source did not return a successful response: ${url}`);
}

export async function collectDirectDataset(
  dataset: DataType,
  institutions: readonly Institution[],
  allSources: readonly DirectSource[],
  fetchPage: FetchPage = createSourceFetcher(),
  now = new Date()
): Promise<CollectionResult> {
  const sources = allSources.filter((source) => source.dataset === dataset);
  const blockers: string[] = [];
  const configured = new Set(sources.map((source) => source.institution));
  for (const institution of institutions) {
    const coverage = institution.datasets[dataset];
    if (!coverage) {
      continue;
    }
    if (coverage.status === "excluded") {
      if (!coverage.sourceUrl || !coverage.reviewedAt || !coverage.reason) {
        blockers.push(
          `${institution.id}: exclusion has no reviewed primary evidence`
        );
      }
    } else if (
      coverage.status !== "active" ||
      !configured.has(institution.id)
    ) {
      blockers.push(`${institution.id}: ${coverage.reason}`);
    }
  }
  const ids = sources.map((source) => source.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error(`Duplicate source IDs for ${dataset}`);
  }
  const queue = [...sources];
  const results: SourceResult[] = [];
  const observations = new Map<string, Observation[]>();
  await Promise.all(
    Array.from({ length: Math.min(4, queue.length) }, async () => {
      for (let source = queue.shift(); source; source = queue.shift()) {
        try {
          const institution = institutions.find(
            (item) => item.id === source.institution
          );
          if (
            !institution ||
            institution.datasets[dataset]?.status !== "active"
          ) {
            throw new Error("Source has no active institution coverage entry");
          }
          const pages = new Map<string, string>();
          for (const url of source.urls) {
            pages.set(url, await fetchPage(url));
          }
          const discovered = source.discover?.(pages) ?? [];
          const origins = new Set([
            ...source.urls.map((url) => new URL(url).origin),
            ...(source.documentOrigins ?? []),
          ]);
          if (
            discovered.length > 20 ||
            discovered.some(
              (url) =>
                new URL(url).protocol !== "https:" ||
                !origins.has(new URL(url).origin)
            )
          ) {
            throw new Error(
              "Discovered documents are outside reviewed source origins or exceed the limit"
            );
          }
          const permittedUrls = [...new Set([...source.urls, ...discovered])];
          for (const url of discovered) {
            if (!pages.has(url)) {
              pages.set(url, await fetchPage(url, source.discoveredBrowser));
            }
          }
          const rates = source.parse(pages);
          validateObservations({ ...source, urls: permittedUrls }, rates);
          observations.set(source.institution, [
            ...(observations.get(source.institution) ?? []),
            ...rates,
          ]);
          results.push({
            id: source.id,
            institution: source.institution,
            urls: permittedUrls,
            status: "ok",
            observations: rates.length,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          blockers.push(`${source.id}: ${message}`);
          results.push({
            id: source.id,
            institution: source.institution,
            urls: source.urls,
            status: "failed",
            observations: 0,
            error: message,
          });
        }
      }
    })
  );
  let preview: SupportedModels | null = null;
  blockers.push(...checkLegacyProducts(dataset, institutions, observations));
  try {
    preview = buildModel(dataset, institutions, observations, now);
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : String(error));
  }
  return {
    dataset,
    checkedAt: now.toISOString(),
    sources: results.toSorted((a, b) => a.id.localeCompare(b.id)),
    blockers: blockers.toSorted(),
    model: blockers.length === 0 ? preview : null,
    preview,
  };
}

function checkLegacyProducts(
  dataset: DataType,
  institutions: readonly Institution[],
  observations: ReadonlyMap<string, Observation[]>
): string[] {
  const blockers: string[] = [];
  for (const institution of institutions) {
    const coverage = institution.datasets[dataset];
    const observed = observations.get(institution.id);
    if (!coverage || !observed) {
      continue;
    }
    for (const legacy of unreconciledProducts(
      coverage,
      coverage.legacyProducts,
      observed.map((item) => item.product)
    )) {
      blockers.push(
        `${institution.id}: reconcile legacy product ${JSON.stringify(legacy)} with the direct source`
      );
    }
  }
  return blockers;
}

export function unreconciledProducts(
  coverage: CoverageEntry | undefined,
  previous: string[],
  next: string[]
): string[] {
  const names = new Set(next.map((name) => generateId(["product", name])));
  return previous.filter((name) => {
    if (names.has(generateId(["product", name]))) {
      return false;
    }
    const decision = coverage?.productDecisions?.[name];
    return (
      !decision?.reason ||
      !decision.sourceUrl ||
      !decision.replacements.every((replacement) =>
        names.has(generateId(["product", replacement]))
      )
    );
  });
}

function validateObservations(
  source: DirectSource,
  rates: Observation[]
): void {
  if (rates.length === 0) {
    throw new Error("Source returned no rates");
  }
  for (const rate of rates) {
    if (
      !rate.product.trim() ||
      !Number.isFinite(rate.rate) ||
      rate.rate < 0 ||
      rate.rate > 100 ||
      !source.urls.includes(rate.sourceUrl)
    ) {
      throw new Error(`Invalid rate or provenance for ${rate.product}`);
    }
    if (
      rate.rateMaximum !== undefined &&
      (!Number.isFinite(rate.rateMaximum) ||
        rate.rateMaximum < rate.rate ||
        rate.rateMaximum > 100)
    ) {
      throw new Error(`Invalid maximum rate for ${rate.product}`);
    }
    if ((rate.rateType === "range") !== (rate.rateMaximum !== undefined)) {
      throw new Error(`Range must have both endpoints for ${rate.product}`);
    }
    if (
      source.dataset === "mortgage-rates" &&
      rate.termInMonths !== null &&
      ![6, 12, 18, 24, 36, 48, 60].includes(rate.termInMonths ?? -1)
    ) {
      throw new Error(
        `Missing or unsupported mortgage term for ${rate.product}`
      );
    }
    if (source.dataset === "credit-card-rates") {
      validateCardValues(rate);
    }
  }
}

function validateCardValues(rate: Observation): void {
  for (const value of [rate.cashAdvanceRate, rate.balanceTransferRate]) {
    if (
      value !== null &&
      value !== undefined &&
      (!Number.isFinite(value) || value < 0 || value > 100)
    ) {
      throw new Error(`Invalid card rate for ${rate.product}`);
    }
  }
  for (const value of [rate.primaryFeeNZD, rate.interestFreePeriodInMonths]) {
    if (
      value !== null &&
      value !== undefined &&
      (!Number.isFinite(value) || value < 0)
    ) {
      throw new Error(`Invalid card fee or period for ${rate.product}`);
    }
  }
}

function mortgageTerm(months: number | null): string {
  if (months === null) {
    return "Variable floating";
  }
  if (months % 12 !== 0) {
    return `${months} months`;
  }
  return `${months / 12} ${months === 12 ? "year" : "years"}`;
}

function buildModel(
  dataset: DataType,
  institutions: readonly Institution[],
  observations: ReadonlyMap<string, Observation[]>,
  now: Date
): SupportedModels {
  const data = institutions
    .filter((institution) => observations.has(institution.id))
    .map((institution) => {
      const rates = observations.get(institution.id) ?? [];
      if (dataset === "credit-card-rates") {
        const plans = rates
          .map((rate) => ({
            id: generateId(["plan", institution.id, rate.product]),
            name: rate.product,
            sourceUrl: rate.sourceUrl,
            interestFreePeriodInMonths: rate.interestFreePeriodInMonths ?? null,
            primaryFeeNZD: rate.primaryFeeNZD ?? null,
            balanceTransferRate: rate.balanceTransferRate ?? null,
            balanceTransferPeriod: rate.balanceTransferPeriod ?? null,
            cashAdvanceRate: rate.cashAdvanceRate ?? null,
            purchaseRate: rate.rate,
            ...(rate.condition ? { condition: rate.condition } : {}),
          }))
          .toSorted((a, b) => a.id.localeCompare(b.id));
        assertUnique(plans);
        return {
          id: `issuer:${institution.id}`,
          name: institution.name,
          plans,
        };
      }
      const productNames = [
        ...new Set(rates.map((rate) => rate.product)),
      ].toSorted();
      const products = productNames.map((name) => {
        const productRates = rates
          .filter((rate) => rate.product === name)
          .map((rate) => {
            const common = {
              rate: rate.rate,
              sourceUrl: rate.sourceUrl,
              rateType: rate.rateType ?? "advertised",
              ...(rate.rateMaximum === undefined
                ? {}
                : { rateMaximum: rate.rateMaximum }),
            };
            if (dataset === "mortgage-rates") {
              const months = rate.termInMonths ?? null;
              const term = rate.term ?? mortgageTerm(months);
              return {
                id: generateId(["rate", institution.id, name, term]),
                ...common,
                term,
                termInMonths: months,
                ...(rate.condition ? { condition: rate.condition } : {}),
              };
            }
            return {
              id: generateId([
                "rate",
                institution.id,
                name,
                rate.plan ?? "",
                rate.condition ?? "",
              ]),
              ...common,
              plan: rate.plan ?? null,
              condition: rate.condition ?? null,
            };
          })
          .toSorted((a, b) => a.id.localeCompare(b.id));
        assertUnique(productRates);
        return {
          id: generateId(["product", institution.id, name]),
          name,
          rates: productRates,
        };
      });
      return {
        id: `institution:${institution.id}`,
        name: institution.name,
        products,
      };
    })
    .toSorted((a, b) => a.id.localeCompare(b.id));
  const model = parseSchema(schemas[dataset], {
    type: modelTypes[dataset],
    data,
    lastUpdated: now.toISOString(),
  });
  assertScrapeHasRates(model);
  return model;
}

function assertUnique(items: { id: string }[]): void {
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw new Error("Duplicate product/rate identifiers in direct source data");
  }
}
