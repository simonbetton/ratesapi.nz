import { createFromSource } from "fumadocs-core/search/server";
import { llms, loader } from "fumadocs-core/source";
import { docs } from "fumadocs-mdx:collections/server";

import { toApiUrl } from "./api-url";

export const source = loader({
  baseUrl: "/",
  source: docs.toFumadocsSource(),
  pageTree: {
    transformers: [
      {
        file: (node) => ({ ...node, url: toApiUrl(node.url) }),
      },
    ],
  },
});

export const docsLlms = llms(source);

export const searchApi = createFromSource(source, {
  language: "english",
});
