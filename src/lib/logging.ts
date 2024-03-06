import pino, { type Logger, type LoggerOptions } from "pino";

export function createLogger(
  module: string | { name: string },
  options: Partial<LoggerOptions> = {},
): Logger {
  const moduleName = typeof module === "string" ? module : module.name;
  return pino({
    level: "info", // TODO: Add into a config
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
      },
    },
    ...options,
  }).child({
    moduleName,
  });
}
