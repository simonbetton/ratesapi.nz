import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./test",
  testMatch: "browser-sources.playwright.ts",
  workers: 1,
  retries: 0,
  timeout: 30_000,
  outputDir: "test-results/browser-sources",
  reporter: "list",
});
