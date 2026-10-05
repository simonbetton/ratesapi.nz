import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

interface Step {
  id?: string;
  run?: string;
  uses?: string;
  if?: string;
  env?: Record<string, string>;
  with?: Record<string, string>;
  "continue-on-error"?: boolean;
}

interface Job {
  if?: string;
  needs?: string;
  steps: Step[];
  "continue-on-error"?: boolean;
}

interface Workflow {
  on: {
    pull_request: { paths: string[] };
    workflow_dispatch: { inputs: Record<string, unknown> };
  };
  jobs: Record<string, Job>;
}

const workflow = Bun.YAML.parse(
  readFileSync(
    new URL("../../../.github/workflows/browser-sources.yml", import.meta.url),
    "utf-8"
  )
) as Workflow;

function job(id: string): Job {
  const selected = workflow.jobs[id];
  if (!selected) {
    throw new Error(`Missing workflow job: ${id}`);
  }
  return selected;
}

function step(selected: Job, id: string): Step {
  const found = selected.steps.find((item) => item.id === id);
  if (!found) {
    throw new Error(`Missing workflow step: ${id}`);
  }
  return found;
}

// Execute the actual workflow shell against a fake Bun, with no network or credentials.
function runStep(script: string, exitCode: number, institutions = "all") {
  const directory = mkdtempSync(path.join(tmpdir(), "source-workflow-"));
  try {
    writeFileSync(
      path.join(directory, "bun"),
      '#!/bin/sh\nprintf "command: %s\\n" "$*"\nprintf "browser tests: %s\\n" "$RUN_BROWSER_TESTS"\necho "source diagnostic" >&2\nexit "$FAKE_EXIT_CODE"\n',
      { mode: 0o755 }
    );
    const result = Bun.spawnSync(
      ["bash", "--noprofile", "--norc", "-eo", "pipefail", "-c", script],
      {
        env: {
          PATH: `${directory}:${process.env.PATH ?? ""}`,
          RATES_INSTITUTIONS: institutions,
          FAKE_EXIT_CODE: String(exitCode),
        },
      }
    );
    return {
      exitCode: result.exitCode,
      stdout: result.stdout.toString(),
      stderr: result.stderr.toString(),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("direct source workflow boundaries", () => {
  test("PRs automatically run browser, parser and partial-publication checks without a cloud key", () => {
    const checks = job("source-tests");
    expect(checks.if).toBeUndefined();
    expect(checks["continue-on-error"]).not.toBe(true);
    expect(
      checks.steps.every((item) => item["continue-on-error"] !== true)
    ).toBe(true);
    expect(JSON.stringify(checks)).not.toContain("secrets.");
    expect(JSON.stringify(checks)).not.toContain("sources:audit");
    expect(JSON.stringify(checks)).not.toContain("sources:browser");
    const testStep = step(checks, "source-tests");
    expect(testStep.if).toBeUndefined();
    const command = testStep.run ?? "";
    for (const file of [
      "browser-sources.test.ts",
      "direct-sources.test.ts",
      "partial-publication.test.ts",
      "browser-source-workflow.test.ts",
    ]) {
      expect(command).toContain(`apps/api/test/${file}`);
      expect(workflow.on.pull_request.paths).toContain(`apps/api/test/${file}`);
    }
    const result = runStep(command, 7);
    expect(result.exitCode).toBe(7);
    expect(result.stdout).toContain("browser tests: 1");
  });

  test("the live audit requires explicit manual dispatch after tests pass", () => {
    expect(workflow.on.workflow_dispatch.inputs.browser).toBeDefined();
    const audit = job("live-source-audit");
    expect(audit.if).toBe("github.event_name == 'workflow_dispatch'");
    expect(audit.needs).toBe("source-tests");
    expect(audit["continue-on-error"]).not.toBe(true);
    expect(
      audit.steps.every((item) => item["continue-on-error"] !== true)
    ).toBe(true);
    const live = step(audit, "live-audit");
    expect(live.env?.BROWSER_USE_API_KEY).toBeDefined();
    expect(JSON.stringify(live)).not.toContain("CLOUDFLARE");
    const upload = audit.steps.find(
      (item) => item.uses === "actions/upload-artifact@v4"
    );
    expect(upload?.if).toBe("always()");
    for (const file of [
      "browser-source-report.json",
      "direct-source-report.json",
      "direct-source-report-browser.json",
    ]) {
      expect(upload?.with?.path).toContain(file);
    }
  });

  test.each(["all", "anz"])(
    "manual %s audits preserve failures and diagnostics",
    (institutions) => {
      const command = step(job("live-source-audit"), "live-audit").run ?? "";
      const result = runStep(command, 23, institutions);
      expect(result.exitCode).toBe(23);
      expect(result.stderr).toContain("source diagnostic");
      expect(result.stdout).toContain(
        institutions === "all" ? "run sources:audit" : "run sources:browser"
      );
      expect(runStep(command, 0, institutions).exitCode).toBe(0);
    }
  );
});
