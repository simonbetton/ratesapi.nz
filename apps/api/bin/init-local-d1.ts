import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const databaseName = process.env.D1_DATABASE_NAME?.trim() || "ratesapi-data";
const schemaPath = fileURLToPath(new URL("../schema.sql", import.meta.url));
const wranglerConfigPath = fileURLToPath(
  new URL("../wrangler.toml", import.meta.url),
);

execFileSync(
  "npx",
  [
    "wrangler",
    "d1",
    "execute",
    databaseName,
    "--config",
    wranglerConfigPath,
    "--local",
    "--file",
    schemaPath,
  ],
  {
    stdio: "inherit",
  },
);
