import { scrapeDirect } from "./direct/run";

try {
  await scrapeDirect("credit-card-rates");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
