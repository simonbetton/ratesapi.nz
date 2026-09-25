import { createFromSource } from "fumadocs-core/search/server";
import { llms, loader } from "fumadocs-core/source";
import { docs } from "fumadocs-mdx:collections/server";

import { isApiPath, toApiUrl } from "./api-url";
import { docsBasePath } from "./base-path";

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

// llms.txt is plain text, so its links need the full docs path.
export const docsLlms = llms(
  loader({ baseUrl: docsBasePath, source: docs.toFumadocsSource() })
);

export const searchApi = createFromSource(source, {
  language: "english",
});
