import { execFileSync } from "node:child_process";

import { pageSchema } from "fumadocs-core/source/schema";
import { defineDocs } from "fumadocs-mdx/config";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: pageSchema.extend({
      // A title for search results and social cards. The visible H1 stays
      // `title`. The root layout adds " | Rates API", so do not add it here.
      // The docs app has no zod dependency, so reuse the string schema of
      // `title`.
      seoTitle: pageSchema.shape.title.optional(),
    }),
    // Adds the Markdown of each page for llms-full.txt. The heading IDs
    // ("## Title [#id]") are only useful on the site.
    postprocess: {
      includeProcessedMarkdown: { headingIds: false },
    },
    lastModified: lastCommitDate,
  },
});

// The date of the last commit that changed a page. The sitemap, the JSON-LD
// and the "Last updated" line use it. A shallow clone does not have the full
// history, so it gives no date instead of an incorrect date.
function lastCommitDate(filePath: string): Promise<Date | null> {
  try {
    if (git("rev-parse", "--is-shallow-repository") !== "false") {
      return Promise.resolve(null);
    }

    const date = git("log", "-1", "--format=%cI", "--", filePath);

    return Promise.resolve(date === "" ? null : new Date(date));
  } catch {
    // Git is not available, for example in a source archive.
    return Promise.resolve(null);
  }
}

function git(...args: string[]): string {
  return execFileSync("git", args, {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}
