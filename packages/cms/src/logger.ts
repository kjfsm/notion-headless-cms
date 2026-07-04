import type { LogContext, Logger, LogLevel } from "./types/logger.js";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * `logLevel` 未満のレベルを抑制するラッパを返す。`logger` 未指定なら常に no-op を返すため、
 * 呼び出し側は `logger.debug?.(...)` のような optional-call を書かなくてよい。
 *
 * @param logger 出力先。未指定なら全レベル no-op。
 * @param logLevel 下限レベル。未指定なら全レベル出力。
 */
export function createLeveledLogger(
  logger: Logger | undefined,
  logLevel: LogLevel | undefined,
): Required<Logger> {
  const threshold = logLevel ? LEVEL_ORDER[logLevel] : 0;
  const at =
    (level: LogLevel) =>
    (message: string, context?: LogContext): void => {
      if (!logger || LEVEL_ORDER[level] < threshold) return;
      logger[level]?.(message, context);
    };
  return {
    debug: at("debug"),
    info: at("info"),
    warn: at("warn"),
    error: at("error"),
  };
}
