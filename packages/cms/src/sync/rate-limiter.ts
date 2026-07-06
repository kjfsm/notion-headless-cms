export interface RateLimiterOptions {
  /** 1 秒あたりの最大リクエスト数(Notion API は 3req/s)。 */
  readonly requestsPerSecond: number;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface RateLimiter {
  /** 発行間隔(`requestsPerSecond`)を守った上で `task` を実行する。DO 内で Notion アクセスを一元管理する土台。 */
  schedule<T>(task: () => Promise<T>): Promise<T>;
}

/**
 * グローバル 3req/s レートリミッタ(#441)。Worker isolate ごとではなく
 * DO で一元管理することで、複数リクエストが同時に来ても Notion への
 * 発行間隔を一定に保つ。
 *
 * 「発行間隔の計算(gate)」と「task の実行」を分離している点が重要: gate だけを
 * 直列化キューに乗せ、task の完了は待たずに次の gate 計算へ進む。素朴に
 * `task` の完了まで直列化すると、遅い 1 リクエスト(深いページの再帰取得等)が
 * 後続すべてを堰き止めてしまい、実効レートが「同時実行 1」まで落ち込む。
 */
export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  const now = opts.now ?? (() => Date.now());
  const sleep =
    opts.sleep ??
    ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const intervalMs = 1000 / opts.requestsPerSecond;
  let nextAvailableAt = 0;
  let gate: Promise<void> = Promise.resolve();

  return {
    schedule<T>(task: () => Promise<T>): Promise<T> {
      const myTurn = gate.then(async () => {
        const wait = Math.max(0, nextAvailableAt - now());
        if (wait > 0) await sleep(wait);
        nextAvailableAt = Math.max(now(), nextAvailableAt) + intervalMs;
      });
      // gate はエラーを握りつぶして直列化だけを保つ(実際のエラーは呼び出し元の Promise で伝播する)。
      gate = myTurn.catch(() => undefined);
      return myTurn.then(() => task());
    },
  };
}
