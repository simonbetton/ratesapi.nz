/* oxlint-disable no-await-in-loop -- Temporary sequential first-party response probe. */
import { writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

import { createSourceFetcher } from "./direct/collect";
import { plainText } from "./direct/parsing";
import { directSources } from "./direct/sources";

const source = directSources.find(
  (item) => item.institution === "aotea-finance"
);
if (!source) {
  throw new Error("Missing Aotea source");
}
const url = "https://aoteafinance.co.nz/costs-of-borrowing/";
const samples = [];
for (let index = 0; index < 12; index += 1) {
  const html = await createSourceFetcher()(url);
  const text = plainText(html);
  let parseError: string | null = null;
  try {
    source.parse(new Map([[url, html]]));
  } catch (error) {
    parseError = String(error);
  }
  // Public disclosure text only: no scripts, attributes, headers or credentials.
  samples.push({
    index,
    error: parseError,
    bytes: html.length,
    text: text.slice(0, 15_000),
  });
  console.info(
    `[DEBUG-aotea] sample=${index} bytes=${html.length} parsed=${parseError === null}`
  );
  await sleep(1000);
}
await writeFile(
  "aotea-probe.json",
  JSON.stringify({ samples }, null, 2)
);
