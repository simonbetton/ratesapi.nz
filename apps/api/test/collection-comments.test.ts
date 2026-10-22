import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import nodePath from "node:path";

import {
  buildCollectionComment,
  upsertCollectionComment,
} from "../../../.github/scripts/report-collection";
import type {
  CollectionReport,
  CommentTarget,
} from "../../../.github/scripts/report-collection";

const outage: CollectionReport = {
  dataset: "personal-loan-rates",
  blockers: [],
  warnings: ["Future Finance is unreachable"],
  sources: [
    {
      id: "future-finance",
      institution: "future-finance",
      urls: ["https://bank.example/rates"],
      status: "failed",
      observations: 0,
      error: "Connection timed out",
      failureKind: "outage",
    },
  ],
};
const input = {
  reports: [outage],
  failures: [],
  jobs: [],
  problems: [],
  runUrl: "https://github.com/owner/repo/actions/runs/1",
  sha: "1234567890abcdef",
  dryRun: true,
};

describe("collection failure comments", () => {
  test("reports outages and why without claiming a complete dry run", () => {
    const comment = buildCollectionComment(input);
    expect(comment.hasFindings).toBe(true);
    expect(comment.body).toContain("Connection timed out");
    expect(comment.body).toContain("outage");
    expect(comment.body).toContain("0/1");
    expect(comment.body).toContain("no database writes");
    expect(comment.body).toContain(input.runUrl);
    expect(comment.body).toContain("| Blocking errors |\n| ---");
  });
  test("reports extraction, publication and setup failures even without source reports", () => {
    const comment = buildCollectionComment({
      ...input,
      reports: [
        {
          ...outage,
          blockers: ["Missing rate table"],
          warnings: [],
          sources: [],
        },
      ],
      failures: [
        { dataset: "mortgage-rates", error: "Failed to save mortgage-rates" },
      ],
      jobs: [
        {
          name: "Prepare",
          conclusion: "failure",
          html_url: input.runUrl,
          steps: [{ name: "Verify D1 access", conclusion: "failure" }],
        },
      ],
    });
    expect(comment.body).toContain("Missing rate table");
    expect(comment.body).toContain("Failed to save mortgage-rates");
    expect(comment.body).toContain("Verify D1 access");
  });
  test("recovered sources do not create findings", () => {
    const comment = buildCollectionComment({
      ...input,
      reports: [
        {
          ...outage,
          warnings: [],
          sources: outage.sources.map((source) => ({
            ...source,
            status: "ok",
            observations: 1,
            initialError: "HTTP 503 @someone `bad` <script>",
          })),
        },
      ],
    });
    expect(comment.hasFindings).toBe(false);
    expect(comment.body).not.toContain("recovered");
    expect(comment.body).not.toContain("HTTP 403");
    expect(comment.body).not.toContain("HTTP 503");
  });
  test("reports the final source failure without retry history and escapes untrusted text", () => {
    const comment = buildCollectionComment({
      ...input,
      reports: [
        {
          ...outage,
          sources: outage.sources.map((source) => ({
            ...source,
            initialError: "Initial attempt timed out",
            error: "HTTP 503 @someone `bad` <script>",
          })),
        },
      ],
    });
    expect(comment.hasFindings).toBe(true);
    expect(comment.body).toContain("HTTP 503");
    expect(comment.body).not.toContain("Initial attempt timed out");
    expect(comment.body).not.toContain("@someone");
    expect(comment.body).not.toContain("<script>");
  });
  test("healthy runs have no findings", () => {
    expect(
      buildCollectionComment({
        ...input,
        reports: [{ ...outage, warnings: [], sources: [] }],
      }).hasFindings
    ).toBe(false);
  });
  test.each([123, undefined])(
    "posts to the PR or collected commit and updates an existing report (PR %s)",
    async (prNumber) => {
      const calls: { method: string; path: string; body?: unknown }[] = [];
      let existing = false;
      const request = async (
        method: string,
        path: string,
        body?: unknown
      ): Promise<unknown> => {
        calls.push({ method, path, body });
        if (method !== "GET") {
          return { html_url: "https://github.com/comment" };
        }
        return existing
          ? [
              {
                id: 17,
                body: "<!-- ratesapi-collection-report -->",
                user: { login: "github-actions[bot]" },
              },
            ]
          : [];
      };
      const target: CommentTarget = {
        repository: "owner/repo",
        sha: input.sha,
        prNumber,
      };
      await upsertCollectionComment(
        request,
        target,
        buildCollectionComment(input)
      );
      expect(calls.at(-1)?.method).toBe("POST");
      expect(calls.at(-1)?.path).toContain(
        prNumber ? "/issues/123/comments" : `/commits/${input.sha}/comments`
      );
      existing = true;
      await upsertCollectionComment(
        request,
        target,
        buildCollectionComment({ ...input, reports: [] })
      );
      expect(calls.at(-1)?.method).toBe("PATCH");
      expect(calls.at(-1)?.path).toContain(
        prNumber ? "/issues/comments/17" : "/comments/17"
      );
      expect(JSON.stringify(calls.at(-1)?.body)).toContain("no failures");
    }
  );
  test("does not create a comment for a clean run and surfaces notification failures", async () => {
    const target = { repository: "owner/repo", sha: input.sha };
    let calls = 0;
    await upsertCollectionComment(
      async () => {
        calls += 1;
        return [];
      },
      target,
      buildCollectionComment({ ...input, reports: [] })
    );
    expect(calls).toBe(1);
    await expect(
      upsertCollectionComment(
        async () => {
          throw new Error("Permission denied");
        },
        target,
        buildCollectionComment(input)
      )
    ).rejects.toThrow("Permission denied");
  });
  test("the workflow Node entry point reads artifacts and comments when a job fails", async () => {
    const directory = await mkdtemp(
      nodePath.join(tmpdir(), "collection-comment-")
    );
    let posted: unknown;
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        const { pathname } = new URL(request.url);
        if (pathname.endsWith("/jobs")) {
          return Response.json({
            jobs: [
              {
                name: "Collect personal-loan-rates",
                conclusion: "failure",
                steps: [{ name: "Publish", conclusion: "failure" }],
              },
            ],
          });
        }
        if (request.method === "GET") {
          return Response.json([]);
        }
        posted = await request.json();
        return Response.json({ id: 1 });
      },
    });
    try {
      const artifact = nodePath.join(
        directory,
        "rate-reports",
        "source-coverage-personal-loan-rates"
      );
      await mkdir(artifact, { recursive: true });
      await writeFile(
        nodePath.join(artifact, "direct-source-report.json"),
        JSON.stringify([outage])
      );
      await writeFile(
        nodePath.join(artifact, "direct-run-failure.json"),
        JSON.stringify({
          dataset: "personal-loan-rates",
          error: "Database unavailable",
        })
      );
      await writeFile(
        nodePath.join(artifact, "direct-source-report-browser.json"),
        JSON.stringify([
          {
            url: "https://bank.example/rates",
            host: "local",
            status: "failed",
            error: "Transient browser failure",
          },
        ])
      );
      const brokenArtifact = nodePath.join(directory, "rate-reports", "broken");
      await mkdir(brokenArtifact);
      await writeFile(
        nodePath.join(brokenArtifact, "direct-run-failure.json"),
        "invalid JSON"
      );
      const eventPath = nodePath.join(directory, "event.json");
      const summaryPath = nodePath.join(directory, "summary.md");
      await writeFile(
        eventPath,
        JSON.stringify({ pull_request: { number: 123 } })
      );
      const child = Bun.spawn(
        [
          "node",
          new URL(
            "../../../.github/scripts/report-collection.ts",
            import.meta.url
          ).pathname,
        ],
        {
          cwd: directory,
          env: {
            ...process.env,
            GITHUB_TOKEN: "test-token",
            GITHUB_REPOSITORY: "owner/repo",
            GITHUB_SHA: input.sha,
            GITHUB_RUN_ID: "1",
            GITHUB_EVENT_PATH: eventPath,
            GITHUB_API_URL: server.url.origin,
            GITHUB_STEP_SUMMARY: summaryPath,
            COLLECTION_RESULT: "failure",
            COLLECTION_DRY_RUN: "true",
          },
          stdout: "pipe",
          stderr: "pipe",
        }
      );
      const status = await child.exited;
      const stderr = await new Response(child.stderr).text();
      expect(status, stderr).toBe(0);
      const summary = await readFile(summaryPath, "utf-8");
      expect(posted).toEqual({ body: summary });
      expect(summary).toContain("Connection timed out");
      expect(summary).toContain("Database unavailable");
      expect(summary).toContain("Report unavailable");
      expect(summary).toContain("Publish");
      expect(summary).not.toContain("test-token");
      expect(summary).not.toContain("Transient browser failure");
    } finally {
      server.stop(true);
      await rm(directory, { recursive: true, force: true });
    }
  });
});
