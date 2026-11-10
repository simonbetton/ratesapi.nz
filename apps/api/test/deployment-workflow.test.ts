import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const workflow = Bun.YAML.parse(
  readFileSync(
    new URL("../../../.github/workflows/deploy.yml", import.meta.url),
    "utf-8"
  )
) as {
  concurrency?: { group: string; "cancel-in-progress": boolean };
  jobs: {
    deploy: {
      if?: string;
      steps: { name?: string; run?: string; env?: Record<string, string> }[];
    };
  };
};

test("production deployments cannot overlap or be interrupted midway through the three Workers", () => {
  expect(workflow.concurrency?.group).toBeTruthy();
  expect(workflow.concurrency?.["cancel-in-progress"]).toBe(false);
});

test("production deployment checks the current main commit immediately before deploying", () => {
  expect(workflow.jobs.deploy.if).toContain("refs/heads/main");
  const step = workflow.jobs.deploy.steps.find((item) =>
    item.run?.includes("bun run deploy")
  );
  expect(step?.run).toMatch(/assert-current-main\.sh\s+bun run deploy/u);
  expect(step?.env?.GH_TOKEN).toBeDefined();
});
