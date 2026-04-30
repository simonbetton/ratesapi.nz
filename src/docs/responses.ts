import { createSearchAPI } from "fumadocs-core/search/server";
import { toLlmsEntry } from "./render";
import { type DocsPageData, docsSource } from "./source";

const docsSearchApi = createSearchAPI("simple", {
  language: "english",
  indexes: docsSource.getPages().map((page) => {
    const pageData = page.data as DocsPageData;

    return {
      title: pageData.title,
      description: pageData.description,
      breadcrumbs: page.slugs,
      content: [
        pageData.title,
        pageData.description,
        pageData.endpoint?.path,
        pageData.endpoint?.operationId,
        pageData.markdown,
      ]
        .filter((value): value is string => typeof value === "string")
        .join("\n\n"),
      url: page.url,
    };
  }),
});

export function renderLlmsTxt(): Response {
  return new Response(docsSource.getPages().map(toLlmsEntry).join("\n\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

export function renderDocsSearch(request: Request): Promise<Response> {
  return docsSearchApi.GET(request);
}

export const GET = renderDocsSearch;
