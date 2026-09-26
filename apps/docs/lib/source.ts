import { flattenTree } from "fumadocs-core/page-tree";
import { createFromSource } from "fumadocs-core/search/server";
import { loader } from "fumadocs-core/source";
import { docs } from "fumadocs-mdx:collections/server";

import { isApiPath, toApiUrl } from "./api-url";

export const source = loader({
  // Relative to the Next.js basePath, which next/link adds.
  baseUrl: "/",
  source: docs.toFumadocsSource(),
  pageTree: {
    transformers: [
      {
        file: (node) =>
          isApiPath(node.url)
            ? { ...node, url: toApiUrl(node.url), external: true }
            : node,
      },
    ],
  },
});

export type DocsPage = NonNullable<ReturnType<typeof source.getPage>>;

// The pages in the sidebar, in sidebar order. The sitemap and the llms.txt
// files use this list, so a page that is not in a meta.json file is not
// listed. External links, for example the OpenAPI reference, are not pages.
export function getNavPages(): DocsPage[] {
  return flattenTree(source.getPageTree().children).flatMap((node) => {
    const page = source.getNodePage(node);

    return page ? [page] : [];
  });
}

// Section index pages (the docs root and each folder index) list other
// pages. All other pages are articles.
export function isHubPage(page: DocsPage): boolean {
  return page.path === "index.mdx" || page.path.endsWith("/index.mdx");
}

export const searchApi = createFromSource(source, {
  language: "english",
});
