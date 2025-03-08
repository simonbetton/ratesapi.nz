import { D1Database } from "@cloudflare/workers-types";

export type Environment = {
  ENVIRONMENT: string;
  RATESAPI_DB: D1Database;
};