/** 指数バックオフ設定(v2 `packages/core/src/retry.ts` を移植)。 */
export interface RetryConfig {
  retryOn: number[];
  maxRetries: number;
  baseDelayMs: number;
  jitter?: boolean;
  onRetry?: (attempt: number, status: number, delayMs?: number) => void;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  retryOn: [429, 502, 503],
  maxRetries: 4,
  baseDelayMs: 1000,
  jitter: true,
};

export interface HttpStatusError {
  status: number;
}

function isHttpStatusError(err: unknown): err is HttpStatusError {
  return (
    typeof err === "object" &&
    err !== null &&
    typeof (err as HttpStatusError).status === "number"
  );
}

/**
 * 指数バックオフ(オプションでジッター付き)でリトライする。
 * `config.retryOn` に含まれる HTTP ステータスを持つエラーのみリトライ対象。
 * Notion API の 3req/s レートリミットへの対応(#441 の直列化の基盤)。
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      const status = isHttpStatusError(err) ? err.status : undefined;
      if (
        status === undefined ||
        !config.retryOn.includes(status) ||
        attempt >= config.maxRetries
      ) {
        throw err;
      }
      const base = config.baseDelayMs * 2 ** attempt;
      const delayMs =
        config.jitter === false ? base : base * (0.5 + Math.random() * 0.5);
      attempt++;
      config.onRetry?.(attempt, status, delayMs);
      await sleep(delayMs);
    }
  }
}
