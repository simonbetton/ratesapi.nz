import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { migrateD1 } from "./migrate-d1";

const databaseName = process.env.D1_DATABASE_NAME?.trim() || "ratesapi-data";
const schemaPath = fileURLToPath(new URL("../schema.sql", import.meta.url));
const wranglerConfigPath = fileURLToPath(
  new URL("../wrangler.toml", import.meta.url)
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
  }
);

// schema.sql does not add columns to a table that exists, so bring a local
// database from an older schema up to date.
migrateD1({ target: { databaseName, flags: ["--local"] } });
