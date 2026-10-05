import { scrapeDirect } from "./direct/run";

try {
  await scrapeDirect("mortgage-rates");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
