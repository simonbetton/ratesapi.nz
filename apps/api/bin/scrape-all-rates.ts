import { scrapeAllDirect } from "./direct/run";

try {
  await scrapeAllDirect("direct-source-report.json");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
