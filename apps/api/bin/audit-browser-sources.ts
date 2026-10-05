import { writeFile } from "node:fs/promises";

import type { DataType } from "../src/lib/data-loader";
import { browserMode, createCollectionTransport } from "./direct/browser";
import { collectDirectDataset, schemas } from "./direct/collect";
import type { CollectionResult } from "./direct/collect";
import { directSources, institutions } from "./direct/sources";

// Deliberately has no D1 persistence dependency. This command is safe for CI access testing.
const selectedIds = (
  process.env.RATES_INSTITUTIONS ?? "anz,asb,bnz,kiwibank,westpac,tsb-bank"
)
  .split(",")
  .map((id) => id.trim());
const selected = institutions.filter((institution) =>
  selectedIds.includes(institution.id)
);
if (selected.length !== new Set(selectedIds).size) {
  throw new Error("RATES_INSTITUTIONS contains an unknown institution ID");
}
const sources = directSources.filter((source) =>
  selectedIds.includes(source.institution)
);
const transport = createCollectionTransport(sources);
const reportPath = process.argv[2] ?? "browser-source-report.json";
const results: CollectionResult[] = [];
try {
  for (const dataset of Object.keys(schemas) as DataType[]) {
    if (!selected.some((institution) => institution.datasets[dataset])) {
      continue;
    }
    // oxlint-disable-next-line no-await-in-loop -- Share one bounded browser queue across datasets.
    const result = await collectDirectDataset(
      dataset,
      selected,
      sources,
      transport.fetchPage
    );
    results.push(result);
    console.info(
      `${dataset}: ${result.sources.filter((source) => source.status === "ok").length}/${result.sources.length} adapters passed; ${result.blockers.length} coverage blockers`
    );
  }
  // An unimplemented source must still receive a real browser access check.
  if (
    selectedIds.includes("tsb-bank") &&
    !sources.some((source) => source.id === "tsb-mortgage")
  ) {
    const url = "https://www.tsb.co.nz/rates-fees-agreements/home-loan";
    const probe = createCollectionTransport([
      {
        id: "tsb-access",
        institution: "tsb-bank",
        dataset: "mortgage-rates",
        urls: [url],
        browser: { [url]: { selector: "td", minimumRates: 17 } },
        parse: () => [],
      },
    ]);
    try {
      await probe.fetchPage(url);
    } catch {
      process.exitCode = 1;
    } finally {
      transport.attempts.push(...probe.attempts);
      await probe.close();
    }
  }
} finally {
  try {
    await writeFile(
      reportPath,
      `${JSON.stringify({ checkedAt: new Date().toISOString(), mode: browserMode(), attempts: transport.attempts, results }, null, 2)}\n`
    );
  } finally {
    await transport.close();
  }
}
if (
  results.some((result) =>
    result.sources.some((source) => source.status === "failed")
  ) ||
  transport.attempts.some(
    (attempt) =>
      attempt.status === "failed" &&
      !transport.attempts.some(
        (success) => success.url === attempt.url && success.status === "ok"
      )
  )
) {
  process.exitCode = 1;
}
console.info(
  `Browser access report: ${reportPath}. Coverage blockers are reported separately; this command never publishes.`
);
