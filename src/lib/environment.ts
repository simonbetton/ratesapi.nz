export type DatabaseStatement = {
  bind(...values: unknown[]): DatabaseStatement;
  first(): Promise<Record<string, unknown> | null>;
  all(): Promise<{ results: Record<string, unknown>[] }>;
  run(): Promise<unknown>;
};

export type Database = {
  prepare(sql: string): DatabaseStatement;
};

export type Environment = {
  ENVIRONMENT: string;
  RATESAPI_DB: Database;
};
