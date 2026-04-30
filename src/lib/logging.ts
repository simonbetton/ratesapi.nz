import pino, { type Logger, type LoggerOptions } from "pino";

export function createLogger(
  module: string | { name: string },
  options: Partial<LoggerOptions> = {},
): Logger {
  const moduleName = typeof module === "string" ? module : module.name;
  const isNodeRuntime =
    typeof process !== "undefined" && Boolean(process.versions?.node);
  const env = isNodeRuntime ? process.env : undefined;
  const usePrettyTransport = env?.LOG_PRETTY === "true";

  return pino({
    level: env?.LOG_LEVEL ?? "info",
    ...(usePrettyTransport
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
            },
          },
        }
      : {}),
    ...options,
  }).child({
    moduleName,
  });
}
