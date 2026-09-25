import { afterEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// This test exercises the real `.github/workflows/uptime.yml` "Check API
// Endpoints" step by extracting its `run:` block from the YAML source and
// executing it with the same shell GitHub Actions uses
// (`bash --noprofile --norc -eo pipefail <script file>`), against a fake
// `bun` binary on PATH. It never invokes the real uptime-check script, and
// makes no network requests.

const WORKFLOW_PATH = path.join(
  import.meta.dir,
  "../../../.github/workflows/uptime.yml"
);
const STEP_ID = "health-check";

/**
 * Extracts the dedented body of a `run: |` block belonging to the step with
 * the given `id:` in a GitHub Actions workflow YAML file, without pulling in
 * a full YAML parser. This is intentionally narrow: it only understands the
 * fixed shape of this one workflow (a literal block scalar `run: |` directly
 * following an `id:` line).
 */
function extractRunBlock(yaml: string, stepId: string): string {
  const lines = yaml.split("\n");

  const idLineIndex = lines.findIndex((line) =>
    new RegExp(`^\\s*id:\\s*${stepId}\\s*$`, "u").test(line)
  );
  if (idLineIndex === -1) {
    throw new Error(`Could not find a step with id: ${stepId}`);
  }

  let runLineIndex = -1;
  let runKeyIndent = 0;
  for (let i = idLineIndex + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    // Stop looking if we hit the next step before finding a run block.
    if (/^\s*- name:/u.test(line)) {
      break;
    }
    const match = line.match(/^(?<indent>\s*)run:\s*\|\s*$/u);
    if (match) {
      runLineIndex = i;
      runKeyIndent = (match.groups?.indent ?? "").length;
      break;
    }
  }
  if (runLineIndex === -1) {
    throw new Error(`Could not find a "run: |" block for step id: ${stepId}`);
  }

  let blockIndent = -1;
  const bodyLines: string[] = [];
  for (let i = runLineIndex + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (line.trim() === "") {
      bodyLines.push("");
      continue;
    }
    const indent = (line.match(/^ */u)?.[0] ?? "").length;
    if (blockIndent === -1) {
      if (indent <= runKeyIndent) {
        throw new Error("Run block has no indented content");
      }
      blockIndent = indent;
    }
    if (indent < blockIndent) {
      break;
    }
    bodyLines.push(line.slice(blockIndent));
  }

  // Drop trailing blank lines picked up before the terminating (less
  // indented, or EOF) line.
  while (bodyLines.length > 0 && bodyLines.at(-1) === "") {
    bodyLines.pop();
  }

  if (bodyLines.length === 0) {
    throw new Error("Extracted run block was empty");
  }

  return bodyLines.join("\n");
}

/**
 * Parses a GITHUB_ENV-format file and extracts the value assigned to
 * `varName` via the `NAME<<DELIMITER ... DELIMITER` multiline convention.
 * The delimiter is read from the file itself (not assumed to be "EOF"),
 * matching how the real GitHub Actions runner parses this format.
 */
function parseMultilineEnvVar(
  envFileContents: string,
  varName: string
): string | undefined {
  const lines = envFileContents.split("\n");
  const startIndex = lines.findIndex((line) =>
    new RegExp(`^${varName}<<(?<delimiter>.+)$`, "u").test(line)
  );
  if (startIndex === -1) {
    return undefined;
  }
  const delimiter = (lines[startIndex] ?? "").slice(`${varName}<<`.length);

  const endIndex = lines.findIndex(
    (line, i) => i > startIndex && line === delimiter
  );
  if (endIndex === -1) {
    throw new Error(
      `Found "${varName}<<${delimiter}" but no matching closing delimiter line`
    );
  }

  return lines.slice(startIndex + 1, endIndex).join("\n");
}

interface Fixture {
  dir: string;
  githubEnvPath: string;
  scriptPath: string;
  run: () => { exitCode: number; stdout: string; stderr: string };
}

const fixtures: Fixture[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture.dir, { recursive: true, force: true });
  }
});

/**
 * Builds a temporary directory that looks like a checkout root (containing
 * apps/api/bin/uptime-check.ts) plus a fake `bun` executable placed first on
 * PATH, so `bun run ./apps/api/bin/uptime-check.ts` inside the extracted
 * workflow script invokes the fake instead of a real bun/network call.
 */
function createFixture(options: {
  bunExitCode: number;
  bunStdout: string;
  bunStderr: string;
}): Fixture {
  const dir = mkdtempSync(path.join(tmpdir(), "uptime-workflow-"));

  const scriptPath = path.join(dir, "apps", "api", "bin", "uptime-check.ts");
  mkdirSync(path.dirname(scriptPath), { recursive: true });
  writeFileSync(scriptPath, "// fake uptime-check.ts for testing\n");

  const fakeBinDir = path.join(dir, "fake-bin");
  mkdirSync(fakeBinDir, { recursive: true });
  const fakeBunPath = path.join(fakeBinDir, "bun");
  writeFileSync(
    fakeBunPath,
    [
      "#!/bin/sh",
      // Never touch the network or a real bun/uptime-check script: just
      // emit the configured stdout/stderr and exit with the configured code.
      'if [ -n "$FAKE_BUN_STDOUT" ]; then printf %s "$FAKE_BUN_STDOUT"; fi',
      'if [ -n "$FAKE_BUN_STDERR" ]; then printf %s "$FAKE_BUN_STDERR" >&2; fi',
      // oxlint-disable-next-line no-template-curly-in-string -- literal shell syntax for the fake bun script, not a JS template
      'exit "${FAKE_BUN_EXIT_CODE:-0}"',
      "",
    ].join("\n")
  );
  chmodSync(fakeBunPath, 0o755);

  const runBlockScriptPath = path.join(dir, "run-block.sh");
  const workflowYaml = readFileSync(WORKFLOW_PATH, "utf-8");
  const runBlock = extractRunBlock(workflowYaml, STEP_ID);
  writeFileSync(runBlockScriptPath, `${runBlock}\n`);

  const githubEnvPath = path.join(dir, "github_env");
  writeFileSync(githubEnvPath, "");

  const fixture: Fixture = {
    dir,
    githubEnvPath,
    scriptPath,
    run: () => {
      const result = Bun.spawnSync(
        [
          "bash",
          "--noprofile",
          "--norc",
          "-eo",
          "pipefail",
          runBlockScriptPath,
        ],
        {
          cwd: dir,
          env: {
            // Fake bin dir first so it shadows any real `bun` on PATH.
            PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`,
            GITHUB_ENV: githubEnvPath,
            FAKE_BUN_EXIT_CODE: String(options.bunExitCode),
            FAKE_BUN_STDOUT: options.bunStdout,
            FAKE_BUN_STDERR: options.bunStderr,
          },
        }
      );
      return {
        exitCode: result.exitCode ?? -1,
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString(),
      };
    },
  };
  fixtures.push(fixture);
  return fixture;
}

describe("uptime workflow health-check step", () => {
  test("preserves stdout and stderr diagnostics and the original exit code on failure", () => {
    const fixture = createFixture({
      bunExitCode: 3,
      bunStdout: "- v1/mortgage-rates (Status 503)",
      bunStderr: "network timeout contacting v1/mortgage-rates",
    });

    const result = fixture.run();

    expect(result.exitCode).toBe(3);

    const envContents = readFileSync(fixture.githubEnvPath, "utf-8");
    const detailedFailedEndpoints = parseMultilineEnvVar(
      envContents,
      "DETAILED_FAILED_ENDPOINTS"
    );

    expect(detailedFailedEndpoints).toBeDefined();
    expect(detailedFailedEndpoints).toContain(
      "- v1/mortgage-rates (Status 503)"
    );
    expect(detailedFailedEndpoints).toContain(
      "network timeout contacting v1/mortgage-rates"
    );
  });

  test("does not export a failure variable and exits zero on success", () => {
    const fixture = createFixture({
      bunExitCode: 0,
      bunStdout: "All endpoints are responding correctly.",
      bunStderr: "",
    });

    const result = fixture.run();

    expect(result.exitCode).toBe(0);

    const envContents = readFileSync(fixture.githubEnvPath, "utf-8");
    expect(
      parseMultilineEnvVar(envContents, "DETAILED_FAILED_ENDPOINTS")
    ).toBeUndefined();
  });

  test("falls back to a useful message when the failing script produces no output", () => {
    const fixture = createFixture({
      bunExitCode: 1,
      bunStdout: "",
      bunStderr: "",
    });

    const result = fixture.run();

    expect(result.exitCode).toBe(1);

    const envContents = readFileSync(fixture.githubEnvPath, "utf-8");
    const detailedFailedEndpoints = parseMultilineEnvVar(
      envContents,
      "DETAILED_FAILED_ENDPOINTS"
    );

    expect(detailedFailedEndpoints).toBe(
      "- Uptime check script failed, but produced no output."
    );
  });

  test("uses a delimiter that survives a payload line matching the old fixed EOF delimiter", () => {
    const fixture = createFixture({
      bunExitCode: 1,
      bunStdout: "- v1/health (Status 500)\nEOF\nmore output after EOF",
      bunStderr: "",
    });

    const result = fixture.run();

    expect(result.exitCode).toBe(1);

    const envContents = readFileSync(fixture.githubEnvPath, "utf-8");

    // The delimiter line itself must not be the literal "EOF" used before,
    // since that is exactly the value that would collide with payload
    // content and truncate/corrupt the parsed variable.
    const delimiterLine = envContents
      .split("\n")
      .find((line) => line.startsWith("DETAILED_FAILED_ENDPOINTS<<"));
    expect(delimiterLine).toBeDefined();
    expect(delimiterLine).not.toBe("DETAILED_FAILED_ENDPOINTS<<EOF");

    const detailedFailedEndpoints = parseMultilineEnvVar(
      envContents,
      "DETAILED_FAILED_ENDPOINTS"
    );

    // The payload's own "EOF" line must survive untouched, proving the
    // multiline value was not truncated at that line.
    expect(detailedFailedEndpoints).toBe(
      "- v1/health (Status 500)\nEOF\nmore output after EOF"
    );
  });
});
