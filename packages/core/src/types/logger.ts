/**
 * ログの付加情報。よく使うフィールドを型安全に渡せるようにしつつ、
 * 任意の拡張フィールドは `[key: string]: unknown` で許容する。
 */
export interface LogContext {
  operation?: string;
  slug?: string;
  pageId?: string;
  durationMs?: number;
  attempt?: number;
  /** リトライ間の待機時間 (ms)。`withRetry` の遅延出力で使う。 */
  backoffMs?: number;
  status?: number;
  error?: string;
  collection?: string;
  cacheAdapter?: string;
  /** キャッシュが保存された時刻(ms)。ヒット時の鮮度確認用 */
  cachedAt?: number;
  /** 画像キャッシュの SHA256 ハッシュキー。ストレージと対応付け用 */
  imageHash?: string;
  /**
   * 単一の `createClient` 呼び出しに紐づくトレース ID。
   * `createClient` 内で発行され、ネストされた操作 (list / find / SWR 再生成 / retry など) の
   * 全ログコンテキストに同じ値が伝搬する。複数 CMS クライアントを並走させた際の追跡用。
   */
  traceId?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug?: (message: string, context?: LogContext) => void;
  info?: (message: string, context?: LogContext) => void;
  warn?: (message: string, context?: LogContext) => void;
  error?: (message: string, context?: LogContext) => void;
}
