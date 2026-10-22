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
  on: { pull_request: { paths: string[] } };
  concurrency: { group: string; "cancel-in-progress": boolean };
  permissions: Record<string, string>;
  jobs: Record<
    string,
    {
      needs?: string | string[];
      if?: string;
      permissions?: Record<string, string>;
      "continue-on-error"?: boolean;
      strategy?: { "fail-fast": boolean; matrix: { dataset: string[] } };
      steps: {
        id?: string;
        name?: string;
        run?: string;
        if?: string;
        env?: Record<string, string>;
        uses?: string;
        with?: Record<string, string>;
        "continue-on-error"?: boolean;
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
    expect(prepare?.if).toBe(
      "${{ github.ref == 'refs/heads/main' && github.event_name != 'pull_request' && !inputs.dry_run }}"
    );
    expect(
      prepare?.steps.some(
        (step) => step.run === "bash .github/scripts/wait-for-deployment.sh"
      )
    ).toBe(true);
    expect(collect?.needs).toBe("prepare");
    expect(collect?.if).toBe(
      "${{ !cancelled() && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository) && (github.event_name == 'pull_request' || inputs.dry_run || needs.prepare.result == 'success') }}"
    );
    const dry = collect?.steps.find((step) => step.id === "dry-run");
    const publish = collect?.steps.find((step) => step.id === "publish");
    expect(dry?.if).toBe(
      "${{ github.event_name == 'pull_request' || inputs.dry_run }}"
    );
    expect(dry?.run).toContain("--dry-run");
    expect(JSON.stringify(dry)).not.toContain("CLOUDFLARE");
    expect(JSON.stringify(dry)).not.toContain("D1_");
    expect(publish?.if).toBe(prepare?.if);
    expect(publish?.run).not.toContain("--dry-run");
    expect(publish?.env?.CLOUDFLARE_API_TOKEN).toBeDefined();
  });
  test("collector PRs run live audits without queuing behind production", () => {
    expect(workflow.on.pull_request.paths).toContain("apps/api/bin/**");
    expect(workflow.on.pull_request.paths).toContain(
      ".github/workflows/scrape.yml"
    );
    expect(workflow.concurrency.group).toBe(
      "${{ (github.event_name == 'pull_request' || inputs.dry_run) && format('rate-audit-{0}', github.ref) || 'production-rate-publication' }}"
    );
    const { collect } = workflow.jobs;
    expect(collect?.if).toContain(
      "github.event.pull_request.head.repo.full_name == github.repository"
    );
    const credentialSteps = Object.values(workflow.jobs)
      .flatMap((job) => job.steps)
      .filter((step) => JSON.stringify(step.env ?? {}).includes("CLOUDFLARE"));
    expect(credentialSteps).toHaveLength(3);
    expect(
      collect?.steps
        .filter((step) => JSON.stringify(step.env ?? {}).includes("CLOUDFLARE"))
        .map((step) => step.id)
    ).toEqual(["publish"]);
  });
  test("failed dataset jobs keep separate diagnostic artifacts", () => {
    const upload = workflow.jobs.collect?.steps.find(
      (step) => step.uses === "actions/upload-artifact@v4"
    );
    expect(upload?.if).toBe("always()");
    expect(upload?.with?.name).toContain("${{ matrix.dataset }}");
    expect(upload?.with?.path).toContain("direct-source-report.json");
    expect(upload?.with?.path).toContain("direct-source-report-browser.json");
    expect(upload?.with?.path).toContain("direct-run-failure.json");
  });
  test("reports failures after all collection jobs with write permissions confined to reporting", () => {
    const { collect, report } = workflow.jobs;
    expect(report?.needs).toEqual(["prepare", "collect"]);
    expect(report?.if).toBe(
      "${{ always() && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository) }}"
    );
    expect(report?.permissions).toEqual({
      actions: "read",
      contents: "write",
      "pull-requests": "write",
    });
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(collect?.permissions).toBeUndefined();
    expect(collect?.["continue-on-error"]).not.toBe(true);
    expect(collect?.steps.some((step) => step["continue-on-error"])).toBe(
      false
    );
    expect(JSON.stringify(report)).not.toContain("secrets.");
    expect(
      report?.steps.some(
        (step) => step.run === "node .github/scripts/report-collection.ts"
      )
    ).toBe(true);
    expect(workflow.on.pull_request.paths).toContain(
      ".github/scripts/report-collection.ts"
    );
  });
  test("WBS uses reviewed browser readiness when HTTP access is denied", () => {
    const source = directSources.find((item) => item.id === "wbs-mortgage");
    expect(source?.browser?.["https://wbs.net.nz/home-loans/"]).toMatchObject({
      minimumRates: 4,
      cloudChallenge: true,
    });
  });
});
