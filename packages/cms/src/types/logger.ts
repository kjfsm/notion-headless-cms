/**
 * ログの付加情報。v3 の同期/配信経路でよく使うフィールドを型安全に渡せるようにしつつ、
 * 任意の拡張フィールドは `[key: string]: unknown` で許容する。
 */
export interface LogContext {
  /** 操作名（`syncEntry` / `listChanged` / `webhook` など）。 */
  operation?: string;
  collection?: string;
  slug?: string;
  pageId?: string;
  /** リトライ回数（`withRetry` のバックオフ出力で使う）。 */
  attempt?: number;
  /** リトライ間の待機時間（ms）。 */
  backoffMs?: number;
  /** HTTP ステータス。 */
  status?: number;
  error?: string;
  /** 処理時間（ms）。 */
  durationMs?: number;
  [key: string]: unknown;
}

export interface Logger {
  debug?: (message: string, context?: LogContext) => void;
  info?: (message: string, context?: LogContext) => void;
  warn?: (message: string, context?: LogContext) => void;
  error?: (message: string, context?: LogContext) => void;
}

export type LogLevel = "debug" | "info" | "warn" | "error";
