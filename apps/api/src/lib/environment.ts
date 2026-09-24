export interface DatabaseStatement {
  bind: (...values: unknown[]) => DatabaseStatement;
  first: () => Promise<Record<string, unknown> | null>;
  all: () => Promise<{ results: Record<string, unknown>[] }>;
  run: () => Promise<unknown>;
}

export interface Database {
  prepare: (sql: string) => DatabaseStatement;
}

export interface Environment {
  ENVIRONMENT: string;
  RATESAPI_DB: Database;
}
