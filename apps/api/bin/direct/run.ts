import { writeFile } from "node:fs/promises";

import type { DataType, SupportedModels } from "../../src/lib/data-loader";
import {
  hasDataChanged,
  loadFromD1,
  markCheckedInD1,
  saveToD1,
} from "../utils";
import { createCollectionTransport } from "./browser";
import { collectDirectDataset, schemas, unreconciledProducts } from "./collect";
import type { CollectionResult } from "./collect";
import { directSources, institutions } from "./sources";
import type { Institution } from "./types";

export interface PublishDependencies {
  collect: () => Promise<CollectionResult>;
  load: () => Promise<SupportedModels | null>;
  save: (model: SupportedModels) => Promise<boolean>;
  markChecked: () => Promise<unknown>;
  registry: readonly Institution[];
}

/** This is the only persistence boundary for direct collection. Previews never reach D1. */
export async function publishDirectDataset(
  deps: PublishDependencies
): Promise<"saved" | "unchanged"> {
  const result = await deps.collect();
  assertComplete(result);
  const current = await deps.load();
  assertReplacement(result, current, deps.registry);
  return persist(result, current, deps);
}

function assertComplete(
  result: CollectionResult
): asserts result is CollectionResult & { model: SupportedModels } {
  if (result.blockers.length > 0 || !result.model) {
    throw new Error(
      `Direct collection of ${result.dataset} is incomplete:\n${result.blockers.join("\n")}`
    );
  }
}

function assertReplacement(
  result: CollectionResult & { model: SupportedModels },
  current: SupportedModels | null,
  registry: readonly Institution[]
): void {
  const { model } = result;
  if (current) {
    for (const item of current.data) {
      const [, id] = item.id.split(":");
      const coverage = registry.find((institution) => institution.id === id)
        ?.datasets[result.dataset];
      const replacement = model.data.find((entry) => entry.id === item.id);
      if (replacement) {
        const previous = "plans" in item ? item.plans : item.products;
        const next =
          "plans" in replacement ? replacement.plans : replacement.products;
        const missing = unreconciledProducts(
          coverage,
          previous.map((product) => product.name),
          next.map((product) => product.name)
        );
        if (missing.length > 0) {
          throw new Error(
            `Replacement would remove products from ${item.id} without review: ${missing.join(", ")}`
          );
        }
        continue;
      }
      if (
        coverage?.status !== "excluded" ||
        !coverage.sourceUrl ||
        !coverage.reviewedAt
      ) {
        throw new Error(
          `Replacement would remove ${item.id} without a reviewed exclusion`
        );
      }
    }
  }
}

async function persist(
  result: CollectionResult & { model: SupportedModels },
  current: SupportedModels | null,
  deps: PublishDependencies
): Promise<"saved" | "unchanged"> {
  const { model } = result;
  if (current && !hasDataChanged(model, current)) {
    await deps.markChecked();
    return "unchanged";
  }
  if (!(await deps.save(model))) {
    throw new Error(`Failed to save ${result.dataset}`);
  }
  return "saved";
}

/** Preflight every category and stored snapshot before allowing any database mutation. */
export async function publishDirectBatch(
  dependencies: PublishDependencies[]
): Promise<void> {
  const prepared = await Promise.all(
    dependencies.map(async (deps) => {
      const result = await deps.collect();
      assertComplete(result);
      return { deps, result };
    })
  );
  const verified = await Promise.all(
    prepared.map(async ({ deps, result }) => {
      const current = await deps.load();
      assertReplacement(result, current, deps.registry);
      return { deps, result, current };
    })
  );
  for (const { deps, result, current } of verified) {
    // Wrangler is synchronous; do not launch competing database writes.
    // oxlint-disable-next-line no-await-in-loop
    const status = await persist(result, current, deps);
    console.info(`${result.dataset}: ${status}`);
  }
}

function persistenceFor(result: CollectionResult): PublishDependencies {
  const { dataset } = result;
  return {
    collect: () => Promise.resolve(result),
    load: () => loadFromD1(dataset, schemas[dataset], { strict: true }),
    save: (model) => saveToD1(model, dataset),
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
  const transport = createCollectionTransport(directSources);
  let result: CollectionResult;
  try {
    result = await collectDirectDataset(
      dataset,
      institutions,
      directSources,
      transport.fetchPage
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
  const transport = createCollectionTransport(directSources);
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
        fetchPage
      );
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
