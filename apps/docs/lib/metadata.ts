import type { Metadata } from "next";

import { siteName, socialImage } from "./site";

// Next.js replaces the whole `openGraph` and `twitter` objects of the layout
// when a page sets them, so each page must repeat these defaults.
export const openGraphDefaults = {
  siteName,
  locale: "en_NZ",
  images: [socialImage],
} satisfies Metadata["openGraph"];

export const twitterDefaults = {
  card: "summary_large_image",
  images: [socialImage],
} satisfies Metadata["twitter"];
