import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const script = path.join(
  import.meta.dir,
  "../../../.github/scripts/wait-for-deployment.sh"
);
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

// Exercise the production shell script without GitHub access or real waits.
function runGate(statuses: string[], ref = "refs/heads/main") {
  const directory = mkdtempSync(path.join(tmpdir(), "deployment-gate-"));
  directories.push(directory);
  writeFileSync(path.join(directory, "responses"), statuses.join("\n"));
  writeFileSync(path.join(directory, "calls"), "");
  writeFileSync(
    path.join(directory, "gh"),
    `#!/usr/bin/env bash
set -eu
echo "$*" >> "$GATE_TEST_DIR/calls"
response=$(head -n 1 "$GATE_TEST_DIR/responses")
tail -n +2 "$GATE_TEST_DIR/responses" > "$GATE_TEST_DIR/remaining"
mv "$GATE_TEST_DIR/remaining" "$GATE_TEST_DIR/responses"
if [[ "$response" == "api-error" ]]; then exit 1; fi
echo "$response"
`,
    { mode: 0o755 }
  );
  writeFileSync(
    path.join(directory, "sleep"),
    "#!/usr/bin/env bash\nexit 0\n",
    {
      mode: 0o755,
    }
  );
  const result = Bun.spawnSync(["bash", script], {
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH}`,
      GATE_TEST_DIR: directory,
      GITHUB_REPOSITORY: "test/rates",
      GITHUB_SHA: "new-commit",
      GITHUB_REF: ref,
    },
  });
  return {
    exitCode: result.exitCode,
    output: result.stdout.toString(),
    calls: readFileSync(path.join(directory, "calls"), "utf-8")
      .split("\n")
      .filter(Boolean),
  };
}

describe("production deployment gate", () => {
  test("waits for the matching commit to finish deploying", () => {
    const result = runGate(["missing", "queued", "in_progress", "success"]);
    expect(result.exitCode).toBe(0);
    expect(result.calls).toHaveLength(4);
    for (const call of result.calls) {
      expect(call).toContain(
        "--workflow deploy.yml --branch main --commit new-commit"
      );
      expect(call).toContain("--repo test/rates");
    }
    expect(result.output).toContain("publication may proceed");
  });

  test.each(["failure", "cancelled", "timed_out", "skipped", "", "api-error"])(
    "blocks publication when deployment status is %s",
    (status) => {
      const result = runGate([status]);
      expect(result.exitCode).not.toBe(0);
      expect(result.output).not.toContain("publication may proceed");
    }
  );

  test("stops waiting when a deployment never appears", () => {
    const result = runGate(Array.from({ length: 30 }, () => "missing"));
    expect(result.exitCode).toBe(1);
    expect(result.calls).toHaveLength(30);
    expect(result.output).toContain("Timed out waiting for deployment");
  });

  test("refuses production writes from another branch", () => {
    const result = runGate(["success"], "refs/heads/feature");
    expect(result.exitCode).toBe(1);
    expect(result.calls).toHaveLength(0);
  });
});
