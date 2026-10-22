/* oxlint-disable no-await-in-loop -- Artifact traversal and comment pagination are bounded sequential I/O. */
import { appendFile, readdir, readFile } from "node:fs/promises";
import nodePath from "node:path";
import { pathToFileURL } from "node:url";

import type { CollectionResult } from "../../apps/api/bin/direct/collect";

export type CollectionReport = Pick<
  CollectionResult,
  "dataset" | "sources" | "blockers" | "warnings"
>;
interface RunFailure {
  dataset: string;
  error: string;
}
interface Job {
  name: string;
  conclusion: string | null;
  html_url?: string;
  steps?: { name: string; conclusion: string | null }[];
}
interface ReportInput {
  reports: CollectionReport[];
  failures: RunFailure[];
  jobs: Job[];
  problems: string[];
  runUrl: string;
  sha: string;
  dryRun: boolean;
}
export interface CommentTarget {
  repository: string;
  sha: string;
  prNumber?: number;
}
type Request = (
  method: string,
  path: string,
  body?: unknown
) => Promise<unknown>;
const marker = "<!-- ratesapi-collection-report -->";

function code(value: string): string {
  return `\`${value
    .slice(0, 700)
    .replaceAll(/[\r\n\t]/gu, " ")
    .replaceAll("`", "'")
    .replaceAll("@", "@\u200B")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("|", "\\|")}\``;
}

function sourceFindings(report: CollectionReport): string[] {
  const findings: string[] = [];
  for (const source of report.sources) {
    if (source.status === "failed") {
      findings.push(
        `- ${code(`${report.dataset} / ${source.id}`)} — ${source.failureKind === "outage" ? "outage" : "blocking failure"}: ${code(source.error ?? "Unknown failure")}`
      );
    }
  }
  for (const warning of report.warnings ?? []) {
    findings.push(
      `- ${code(report.dataset)} — outage warning: ${code(warning)}`
    );
  }
  for (const blocker of report.blockers) {
    findings.push(
      `- ${code(report.dataset)} — blocking error: ${code(blocker)}`
    );
  }
  return findings;
}

export function buildCollectionComment(input: ReportInput): {
  body: string;
  hasFindings: boolean;
} {
  const findings: string[] = [];
  const summary = [
    "| Dataset | Verified sources | Outage warnings | Blocking errors |",
    "| --- | ---: | ---: | ---: |",
  ];
  for (const report of input.reports) {
    summary.push(
      `| ${code(report.dataset)} | ${report.sources.filter((source) => source.status === "ok").length}/${report.sources.length} | ${report.warnings?.length ?? 0} | ${report.blockers.length} |`
    );
    findings.push(...sourceFindings(report));
  }
  for (const failure of input.failures) {
    findings.push(
      `- ${code(failure.dataset)} — collection/publication failure: ${code(failure.error)}`
    );
  }
  for (const job of input.jobs) {
    if (!["failure", "timed_out", "cancelled"].includes(job.conclusion ?? "")) {
      continue;
    }
    const failed = job.steps
      ?.filter((step) =>
        ["failure", "timed_out", "cancelled"].includes(step.conclusion ?? "")
      )
      .map((step) => step.name)
      .join(", ");
    findings.push(
      `- Job ${code(job.name)} ${code(job.conclusion ?? "failed")}${failed ? ` during ${code(failed)}` : ""}. [Logs](${job.html_url ?? input.runUrl})`
    );
  }
  for (const problem of input.problems) {
    findings.push(`- Report unavailable: ${code(problem)}`);
  }
  const hasFindings = findings.length > 0;
  const text = [
    marker,
    `**Rate collection: ${hasFindings ? "failures reported" : "no failures in the latest run"}**`,
    `[Workflow run](${input.runUrl}) · Commit ${code(input.sha.slice(0, 12))} · ${input.dryRun ? "Dry run — no database writes." : "Production collection."}`,
    summary.join("\n"),
    "Connection/access outages are warnings. Healthy institutions continue independently; failed institutions retain previous data and do not advance complete-check freshness. Extraction, validation and persistence errors remain blocking.",
    ...findings,
  ].join("\n\n");
  return {
    body:
      text.length > 55_000
        ? `${text.slice(0, 55_000)}\n\nAdditional details are in the workflow artifacts.`
        : text,
    hasFindings,
  };
}

export async function upsertCollectionComment(
  request: Request,
  target: CommentTarget,
  comment: { body: string; hasFindings: boolean }
): Promise<void> {
  const prefix = `/repos/${target.repository}`;
  const path = target.prNumber
    ? `${prefix}/issues/${target.prNumber}/comments`
    : `${prefix}/commits/${target.sha}/comments`;
  let existing: number | undefined;
  for (let page = 1; ; page += 1) {
    const comments = (await request(
      "GET",
      `${path}?per_page=100&page=${page}`
    )) as { id: number; body: string; user: { login: string } }[];
    existing = comments.find(
      (item) =>
        item.user.login === "github-actions[bot]" && item.body.includes(marker)
    )?.id;
    if (existing || comments.length < 100) {
      break;
    }
  }
  if (existing) {
    await request(
      "PATCH",
      target.prNumber
        ? `${prefix}/issues/comments/${existing}`
        : `${prefix}/comments/${existing}`,
      { body: comment.body }
    );
  } else if (comment.hasFindings) {
    await request("POST", path, { body: comment.body });
  }
}

async function readReports(
  root: string
): Promise<Pick<ReportInput, "reports" | "failures" | "problems">> {
  const result: Pick<ReportInput, "reports" | "failures" | "problems"> = {
    reports: [],
    failures: [],
    problems: [],
  };
  async function visit(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const file = nodePath.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(file);
        continue;
      }
      if (
        !["direct-source-report.json", "direct-run-failure.json"].includes(
          entry.name
        )
      ) {
        continue;
      }
      try {
        const data: unknown = JSON.parse(await readFile(file, "utf-8"));
        if (entry.name === "direct-run-failure.json") {
          if (
            !data ||
            typeof data !== "object" ||
            !("error" in data) ||
            typeof data.error !== "string" ||
            !("dataset" in data) ||
            typeof data.dataset !== "string"
          ) {
            throw new Error("Invalid run failure report");
          }
          result.failures.push({ dataset: data.dataset, error: data.error });
        } else if (entry.name === "direct-source-report.json") {
          if (
            !Array.isArray(data) ||
            data.some(
              (item) =>
                typeof item.dataset !== "string" ||
                !Array.isArray(item.sources) ||
                !Array.isArray(item.blockers)
            )
          ) {
            throw new Error("Invalid collection report");
          }
          result.reports.push(...(data as CollectionReport[]));
        }
      } catch (error) {
        result.problems.push(
          `${entry.name}: ${error instanceof Error ? error.message : "Invalid JSON"}`
        );
      }
    }
  }
  await visit(root).catch(() => {
    result.problems.push(
      "Collection artifacts could not be read; inspect the failed job logs."
    );
  });
  return result;
}

async function main(): Promise<void> {
  const {
    GITHUB_TOKEN: token,
    GITHUB_REPOSITORY: repository,
    GITHUB_SHA: sha,
    GITHUB_RUN_ID: runId,
    GITHUB_EVENT_PATH: eventPath,
  } = process.env;
  if (!token || !repository || !sha || !runId || !eventPath) {
    throw new Error("Missing GitHub workflow context");
  }
  const request: Request = async (method, path, body) => {
    const response = await fetch(
      `${process.env.GITHUB_API_URL ?? "https://api.github.com"}${path}`,
      {
        method,
        signal: AbortSignal.timeout(20_000),
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }
    );
    if (!response.ok) {
      throw new Error(
        `GitHub ${method} ${path} failed with HTTP ${response.status}`
      );
    }
    return response.json();
  };
  const event = JSON.parse(await readFile(eventPath, "utf-8")) as {
    pull_request?: { number: number };
  };
  const { jobs } = (await request(
    "GET",
    `/repos/${repository}/actions/runs/${runId}/jobs?per_page=100`
  )) as { jobs: Job[] };
  const reports = await readReports("rate-reports");
  if (
    process.env.COLLECTION_RESULT === "success" &&
    reports.reports.length !== 4
  ) {
    reports.problems.push("Expected reports from all four collection jobs.");
  }
  const comment = buildCollectionComment({
    ...reports,
    jobs,
    runUrl: `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${repository}/actions/runs/${runId}`,
    sha,
    dryRun: process.env.COLLECTION_DRY_RUN === "true",
  });
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, comment.body);
  }
  await upsertCollectionComment(
    request,
    { repository, sha, prNumber: event.pull_request?.number },
    comment
  );
  // oxlint-disable-next-line no-console -- Workflow status output contains no credentials.
  console.info(
    comment.hasFindings
      ? "Collection failures reported on GitHub."
      : "No collection failures to report."
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
