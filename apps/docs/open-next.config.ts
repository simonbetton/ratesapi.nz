import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default {
  ...defineCloudflareConfig(),
  // OpenNext defaults to `bun run build`, which is this OpenNext build itself.
  buildCommand: "next build",
};
