import type { MetadataRoute } from "next";

import { toDocsUrl } from "@/lib/site";
import { getNavPages } from "@/lib/source";

// Served at /docs/sitemap.xml, because Next.js adds the base path. The build
// makes this file one time.
export const dynamic = "force-static";

// Each page in the sidebar, so a new page is added automatically. The date is
// from the last Git commit that changed the page (see source.config.ts). If
// the build has no Git history, the sitemap has no dates. Google ignores
// priority and changefreq, so they are not set.
export default function sitemap(): MetadataRoute.Sitemap {
  return getNavPages().map((page) => ({
    url: toDocsUrl(page.url),
    ...(page.data.lastModified ? { lastModified: page.data.lastModified } : {}),
  }));
}
