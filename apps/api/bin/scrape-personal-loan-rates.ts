import { scrapeDirect } from "./direct/run";

try {
  await scrapeDirect("personal-loan-rates");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
