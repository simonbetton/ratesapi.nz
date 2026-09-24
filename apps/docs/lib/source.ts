import { createFromSource } from "fumadocs-core/search/server";
import { llms, loader } from "fumadocs-core/source";
import { docs } from "fumadocs-mdx:collections/server";

export const source = loader({
  baseUrl: "/",
  source: docs.toFumadocsSource(),
});

export const docsLlms = llms(source);

export const searchApi = createFromSource(source, {
  language: "english",
});
