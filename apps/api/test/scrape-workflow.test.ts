/* oxlint-disable no-template-curly-in-string -- Assert literal GitHub Actions expressions. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { directSources } from "../bin/direct/sources";

const workflow = Bun.YAML.parse(
  readFileSync(
    new URL("../../../.github/workflows/scrape.yml", import.meta.url),
    "utf-8"
  )
) as {
  concurrency: { "cancel-in-progress": boolean };
  jobs: Record<
    string,
    {
      needs?: string;
      if?: string;
      strategy?: { "fail-fast": boolean; matrix: { dataset: string[] } };
      steps: {
        id?: string;
        name?: string;
        run?: string;
        if?: string;
        env?: Record<string, string>;
        uses?: string;
        with?: Record<string, string>;
      }[];
    }
  >;
};

describe("scheduled collection isolation", () => {
  test("tests cannot prevent a scheduled collection from starting", () => {
    const commands = Object.values(workflow.jobs)
      .flatMap((job) => job.steps.map((step) => step.run ?? ""))
      .join("\n");
    expect(commands).not.toContain("bun run check");
    expect(commands).not.toContain("bun test");
  });
  test("all four datasets run independently without cancelling peers", () => {
    const { collect } = workflow.jobs;
    expect(collect?.strategy?.["fail-fast"]).toBe(false);
    expect(collect?.strategy?.matrix.dataset.toSorted()).toEqual([
      "car-loan-rates",
      "credit-card-rates",
      "mortgage-rates",
      "personal-loan-rates",
    ]);
    expect(workflow.concurrency["cancel-in-progress"]).toBe(false);
  });
  test("production is deployment-gated and dry runs cannot receive database credentials", () => {
    const { prepare } = workflow.jobs;
    const { collect } = workflow.jobs;
    expect(prepare?.if).toBe("${{ !inputs.dry_run }}");
    expect(
      prepare?.steps.some(
        (step) => step.run === "bash .github/scripts/wait-for-deployment.sh"
      )
    ).toBe(true);
    expect(collect?.needs).toBe("prepare");
    expect(collect?.if).toBe(
      "${{ !cancelled() && (inputs.dry_run || needs.prepare.result == 'success') }}"
    );
    const dry = collect?.steps.find((step) => step.id === "dry-run");
    const publish = collect?.steps.find((step) => step.id === "publish");
    expect(dry?.if).toBe("${{ inputs.dry_run }}");
    expect(dry?.run).toContain("--dry-run");
    expect(JSON.stringify(dry)).not.toContain("CLOUDFLARE");
    expect(publish?.if).toBe("${{ !inputs.dry_run }}");
    expect(publish?.run).not.toContain("--dry-run");
    expect(publish?.env?.CLOUDFLARE_API_TOKEN).toBeDefined();
  });
  test("failed dataset jobs keep separate diagnostic artifacts", () => {
    const upload = workflow.jobs.collect?.steps.find(
      (step) => step.uses === "actions/upload-artifact@v4"
    );
    expect(upload?.if).toBe("always()");
    expect(upload?.with?.name).toContain("${{ matrix.dataset }}");
    expect(upload?.with?.path).toContain("direct-source-report.json");
    expect(upload?.with?.path).toContain("direct-source-report-browser.json");
  });
  test("WBS uses reviewed browser readiness when HTTP access is denied", () => {
    const source = directSources.find((item) => item.id === "wbs-mortgage");
    expect(source?.browser?.["https://wbs.net.nz/home-loans/"]).toMatchObject({
      minimumRates: 4,
      cloudChallenge: true,
    });
  });
});
