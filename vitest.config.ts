import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        main: "./src/index.ts",
      },
    },
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
  },
});
