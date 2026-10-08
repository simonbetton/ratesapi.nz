import { writeFile } from "node:fs/promises";

import type { DataType, SupportedModels } from "../../src/lib/data-loader";
import { parseSchema } from "../../src/lib/schema";
import {
  hasDataChanged,
  loadFromD1,
  markCheckedInD1,
  saveToD1,
} from "../utils";
import { collectDirectDataset, schemas, unreconciledProducts } from "./collect";
import type { CollectionResult } from "./collect";
import { directSources, institutions } from "./sources";
import { createRecoverableCollectionTransport } from "./transport";
import type { CoverageEntry, Institution } from "./types";

export interface PublishDependencies {
  collect: () => Promise<CollectionResult>;
  load: () => Promise<SupportedModels | null>;
  save: (
    model: SupportedModels,
    options: { complete: boolean }
  ) => Promise<boolean>;
  markChecked: () => Promise<unknown>;
  registry: readonly Institution[];
}

/** Merge verified institutions at the only persistence boundary. Previews never reach D1. */
export async function publishDirectDataset(
  deps: PublishDependencies
): Promise<"saved" | "unchanged"> {
  const result = await deps.collect();
  const candidate = result.publishable;
  if (!candidate) {
    throw new Error(
      `Direct collection of ${result.dataset} is incomplete:\n${result.blockers.join("\n")}`
    );
  }
  const current = await deps.load();
  assertUniqueInstitutions(candidate.data, `collected ${result.dataset}`);
  const blockers = [...result.blockers];
  const replacements = new Map(
    candidate.data.map((entry) => [entry.id, entry])
  );
  const exclusions = new Set<string>();
  for (const item of current?.data ?? []) {
    const [, id] = item.id.split(":");
    const coverage = deps.registry.find((institution) => institution.id === id)
      ?.datasets[result.dataset];
    const replacement = replacements.get(item.id);
    if (!replacement) {
      if (isReviewedExclusion(coverage)) {
        exclusions.add(item.id);
        continue;
      }
      blockers.push(
        `${item.id}: retained previous data because no verified replacement is available`
      );
      continue;
    }
    const previous = "plans" in item ? item.plans : item.products;
    const next =
      "plans" in replacement ? replacement.plans : replacement.products;
    const missing = unreconciledProducts(
      coverage,
      previous.map((product) => product.name),
      next.map((product) => product.name)
    );
    if (missing.length > 0) {
      replacements.delete(item.id);
      blockers.push(
        `Replacement would remove products from ${item.id} without review: ${missing.join(", ")}; retained previous data`
      );
    }
  }
  // Check every legacy row before collapsing an ID to its verified replacement.
  // In particular, old card snapshots split credit/debit/prepaid plans by issuer.
  // Unresolved duplicates still fail closed instead of losing a row in a Map.
  const retained = (current?.data ?? []).filter(
    (entry) => !replacements.has(entry.id) && !exclusions.has(entry.id)
  );
  assertUniqueInstitutions(retained, `stored ${result.dataset}`);
  const merged = [...retained, ...replacements.values()];
  const complete = blockers.length === 0 && result.model !== null;
  if (!complete && blockers.length === 0) {
    blockers.push("The complete dataset was not verified");
  }
  const model = parseSchema(schemas[result.dataset], {
    ...candidate,
    data: merged.toSorted((a, b) => a.id.localeCompare(b.id)),
    // A mixed-age snapshot must not claim retained records were collected now.
    lastUpdated:
      !complete && current ? current.lastUpdated : candidate.lastUpdated,
  });
  const status = await persist(model, current, deps, result.dataset, complete);
  if (!complete) {
    throw new Error(
      `${result.dataset}: partial publication ${status}; ${replacements.size} institutions verified; complete-check freshness unchanged:\n${blockers.join("\n")}`
    );
  }
  return status;
}

function isReviewedExclusion(coverage: CoverageEntry | undefined): boolean {
  return Boolean(
    coverage?.status === "excluded" &&
    coverage.sourceUrl &&
    coverage.reviewedAt &&
    coverage.reason
  );
}

function assertUniqueInstitutions(data: { id: string }[], label: string): void {
  if (new Set(data.map((item) => item.id)).size !== data.length) {
    throw new Error(`Invalid ${label}: duplicate institution identifiers`);
  }
}

async function persist(
  model: SupportedModels,
  current: SupportedModels | null,
  deps: PublishDependencies,
  dataset: DataType,
  complete: boolean
): Promise<"saved" | "unchanged"> {
  if (current && !hasDataChanged(model, current)) {
    if (complete) {
      await deps.markChecked();
    }
    return "unchanged";
  }
  if (!(await deps.save(model, { complete }))) {
    throw new Error(`Failed to save ${dataset}`);
  }
  return "saved";
}

/** Finish independent categories before reporting any collection or persistence errors. */
export async function publishDirectBatch(
  dependencies: PublishDependencies[]
): Promise<void> {
  const errors: unknown[] = [];
  for (const deps of dependencies) {
    try {
      // Wrangler is synchronous; do not launch competing database writes.
      // oxlint-disable-next-line no-await-in-loop
      const status = await publishDirectDataset(deps);
      console.info(`Direct publication: ${status}`);
    } catch (error) {
      errors.push(error);
      console.error(error);
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      `Direct publication completed with errors:\n${errors.map((error) => (error instanceof Error ? error.message : String(error))).join("\n")}`
    );
  }
}

function persistenceFor(result: CollectionResult): PublishDependencies {
  const { dataset } = result;
  return {
    collect: () => Promise.resolve(result),
    load: () => loadFromD1(dataset, schemas[dataset], { strict: true }),
    save: (model, { complete }) => saveToD1(model, dataset, { complete }),
    markChecked: async () => {
      if (!(await markCheckedInD1(dataset))) {
        throw new Error(`Failed to record successful check of ${dataset}`);
      }
    },
    registry: institutions,
  };
}

export async function scrapeDirect(dataset: DataType): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const transport = createRecoverableCollectionTransport(directSources);
  let result: CollectionResult;
  try {
    result = await collectDirectDataset(
      dataset,
      institutions,
      directSources,
      transport.fetchPage,
      undefined,
      { retryFetchPage: transport.retryFetchPage }
    );
  } finally {
    await transport.close();
  }
  console.info(
    `${dataset}: ${result.sources.filter((source) => source.status === "ok").length}/${result.sources.length} sources succeeded; ${result.blockers.length} blockers`
  );
  if (dryRun) {
    console.info(JSON.stringify(result, null, 2));
    if (result.blockers.length > 0) {
      process.exitCode = 1;
    }
    return;
  }
  const status = await publishDirectDataset(persistenceFor(result));
  console.info(`${dataset}: ${status}`);
}

export async function auditDirectSources(reportPath: string): Promise<boolean> {
  const results = await collectAll(reportPath);
  return results.every((result) => result.model !== null);
}

export async function scrapeAllDirect(reportPath: string): Promise<void> {
  const results = await collectAll(reportPath);
  if (process.argv.includes("--dry-run")) {
    if (results.some((result) => result.model === null)) {
      process.exitCode = 1;
    }
    return;
  }
  await publishDirectBatch(results.map(persistenceFor));
}

async function collectAll(reportPath: string): Promise<CollectionResult[]> {
  const transport = createRecoverableCollectionTransport(directSources);
  const { fetchPage } = transport;
  const results: CollectionResult[] = [];
  try {
    for (const dataset of Object.keys(schemas) as DataType[]) {
      // Each dataset already runs four workers; share its cache and network budget.
      // oxlint-disable-next-line no-await-in-loop
      const result = await collectDirectDataset(
        dataset,
        institutions,
        directSources,
        fetchPage,
        undefined,
        { retryFetchPage: transport.retryFetchPage }
      ).catch((error: unknown): CollectionResult => ({
        dataset,
        checkedAt: new Date().toISOString(),
        sources: [],
        blockers: [error instanceof Error ? error.message : String(error)],
        model: null,
        preview: null,
        publishable: null,
      }));
      results.push(result);
      console.info(
        `${dataset}: ${result.sources.filter((source) => source.status === "ok").length}/${result.sources.length} sources succeeded; ${result.blockers.length} blockers`
      );
    }
  } finally {
    try {
      await writeFile(
        `${reportPath.replace(/\.json$/u, "")}-browser.json`,
        `${JSON.stringify(transport.attempts, null, 2)}\n`
      );
    } finally {
      await transport.close();
    }
  }
  await writeFile(reportPath, `${JSON.stringify(results, null, 2)}\n`);
  console.info(`Coverage report: ${reportPath}`);
  return results;
}
