import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default {
  ...defineCloudflareConfig({
    // All docs pages are prerendered and never revalidate. The build copies
    // the prerendered pages into the Workers static assets, and this read-only
    // cache serves them. The default "dummy" cache renders each page again on
    // each request.
    incrementalCache: staticAssetsIncrementalCache,
    // Serve cache hits before the Next.js server loads, to use less CPU time.
    enableCacheInterception: true,
  }),
  // OpenNext defaults to `bun run build`, which is this OpenNext build itself.
  buildCommand: "next build",
};
