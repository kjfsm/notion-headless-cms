export interface RateLimiterOptions {
  /** 1 秒あたりの最大リクエスト数(Notion API は 3req/s)。 */
  readonly requestsPerSecond: number;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface RateLimiter {
  /** キューに並び、順番が来たら `task` を実行する。DO 内で Notion アクセスを一元管理する土台。 */
  schedule<T>(task: () => Promise<T>): Promise<T>;
}

/**
 * グローバル 3req/s レートリミッタ(#441)。Worker isolate ごとではなく
 * DO で一元管理することで、複数リクエストが同時に来ても Notion への
 * 発行間隔を一定に保つ。
 */
export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  const now = opts.now ?? (() => Date.now());
  const sleep = opts.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const intervalMs = 1000 / opts.requestsPerSecond;
  let nextAvailableAt = 0;
  let queue: Promise<unknown> = Promise.resolve();

  return {
    schedule<T>(task: () => Promise<T>): Promise<T> {
      const run = queue.then(async () => {
        const wait = Math.max(0, nextAvailableAt - now());
        if (wait > 0) await sleep(wait);
        nextAvailableAt = Math.max(now(), nextAvailableAt) + intervalMs;
        return task();
      });
      // queue はエラーを握りつぶして直列化だけを保つ(実際のエラーは呼び出し元の Promise で伝播する)。
      queue = run.catch(() => undefined);
      return run;
    },
  };
}
