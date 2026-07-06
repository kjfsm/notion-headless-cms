import type { SyncScheduler } from "../sync-scheduler.js";
import type { JsonValue } from "../types/json-value.js";
import type { Logger } from "../types/logger.js";

export interface EntryChange {
  readonly slug: string;
  readonly lastEditedTime: string;
}

export interface SyncFailure {
  readonly slug: string;
  readonly message: string;
  readonly at: string;
}

/** 1 件の同期/削除が発行した KV 書き込み操作数（無料枠の予算計測用）。 */
export interface SyncWriteResult {
  readonly writes: number;
}

/** 当日ぶんの KV 書き込み累計（UTC 日付でリセットする、DO storage 保存で KV は消費しない）。 */
export interface WriteBudgetState {
  /** UTC 日付（YYYY-MM-DD）。 */
  readonly date: string;
  /** その日に発行した KV 書き込み操作数の累計。 */
  readonly count: number;
}

export interface SyncState {
  readonly cursor: string | null;
  readonly lastSyncAt: string | null;
  readonly lastReconcileAt: string | null;
  readonly failures: readonly SyncFailure[];
  /** 当日ぶんの KV write 累計。旧フォーマットの state には無いため任意。 */
  readonly writeBudget?: WriteBudgetState | null;
}

const EMPTY_STATE: SyncState = {
  cursor: null,
  lastSyncAt: null,
  lastReconcileAt: null,
  failures: [],
  writeBudget: null,
};

export interface SyncCoordinatorDeps {
  /**
   * 差分同期: 保存済みカーソルから最大 `limit` 件の変更を返す。
   * Notion 実装では `page_size: limit` をそのままクエリに渡す想定
   * (= chunked sync の粒度は「1 回のクエリで何件取るか」に直結する)。
   */
  listChanged(
    cursor: string | null,
    limit: number,
  ): Promise<{ changes: readonly EntryChange[]; nextCursor: string | null }>;
  /** 全 slug 一覧(Notion 側の現況。削除検知の突合対象)。 */
  listAllSlugs(): Promise<readonly string[]>;
  /** index に現在登録されている slug 一覧(突合対象)。 */
  listIndexedSlugs(): Promise<readonly string[]>;
  /**
   * 1 entry を実際に同期する(パイプライン実行 + ストア書き込み)。
   * 発行した KV 書き込み操作数(`writes`)を予算計測に反映する。
   */
  syncEntry(change: EntryChange): Promise<SyncWriteResult>;
  /** 削除・非公開化された slug を index から除去する。KV 書き込み操作数を返す。 */
  removeEntry(slug: string): Promise<SyncWriteResult>;
  /** 1 サイクルあたり処理する entry 数(chunked sync の粒度)。既定 2。 */
  chunkSize?: number;
  /** 次チャンクまでの待機時間(ms)。既定 300ms。 */
  chunkDelayMs?: number;
  /** webhook debounce 時間(ms)。既定 3000ms。 */
  debounceMs?: number;
  /** KV write の日次ソフト上限（予算計測の基準値）。既定 1000（無料枠）。 */
  dailyWriteBudget?: number;
  /** ソフト上限に対する警告発火の割合（0〜1）。既定 0.8。 */
  writeBudgetWarnRatio?: number;
  now?: () => string;
  logger?: Logger;
}

function toJsonState(state: SyncState): Record<string, JsonValue> {
  return state as unknown as Record<string, JsonValue>;
}

/**
 * すべての Notion API アクセスを直列化する同期エンジンの中核ロジック(#441)。
 * Cloudflare 実装(DO + Alarm)/ Node 実装のどちらからも `SyncScheduler` 経由で
 * 使えるよう、ランタイム中立に実装する。
 *
 * - chunked sync: 1 呼び出し(Alarm 1 発相当)で `chunkSize` 件だけ問い合わせて処理し、
 *   `nextCursor` が残っていれば `scheduler.schedule` で自己継続する
 * - webhook debounce: `SyncScheduler.schedule` が「既存の予約があれば置き換える」
 *   契約を持つため、同一ページの連続イベントは自然に 1 回の同期に収束する
 * - fail-soft: 1 entry の同期失敗は他の entry の処理を止めない。失敗は
 *   `SyncState.failures` に記録し、直前の正常 snapshot は上書きされない。
 *   `listChanged` 自体の失敗も同様に記録し、次チャンクへの再スケジュールを続ける
 * - `runChunk` は再入防止ガード付き。実行中に webhook 等から再度呼ばれた場合は
 *   完了後にもう一度実行することで取りこぼしを防ぐ(同時実行による index-store への
 *   非アトミックな read-modify-write の競合を避ける)
 * - `reconcile()` も `runChunk` と同じ直列化キュー(`queue`)に乗せて実行する。
 *   どちらも index-store への read-modify-write を伴うため、素朴に並行実行すると
 *   古い state を基点に両者が書き戻し合い、片方の変更が消える(lost update)。
 *   `queue` はこの 2 つの操作の実行区間そのものを直列化することで競合を防ぐ。
 */
export class SyncCoordinatorCore {
  private readonly chunkSize: number;
  private readonly chunkDelayMs: number;
  private readonly debounceMs: number;
  private readonly dailyWriteBudget: number;
  private readonly writeBudgetWarnRatio: number;
  private readonly now: () => string;
  private running = false;
  private rerunRequested = false;
  /** `runChunk`/`reconcile` の実行区間を直列化するキュー。 */
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly scheduler: SyncScheduler,
    private readonly deps: SyncCoordinatorDeps,
  ) {
    this.chunkSize = deps.chunkSize ?? 2;
    this.chunkDelayMs = deps.chunkDelayMs ?? 300;
    this.debounceMs = deps.debounceMs ?? 3000;
    this.dailyWriteBudget = deps.dailyWriteBudget ?? 1000;
    this.writeBudgetWarnRatio = deps.writeBudgetWarnRatio ?? 0.8;
    this.now = deps.now ?? (() => new Date().toISOString());
  }

  /**
   * 当日ぶんの KV write 累計を加算した新しい state を返す。UTC 日付が変われば 0 から数え直す。
   * ソフト上限（`dailyWriteBudget * writeBudgetWarnRatio`）を跨いだ瞬間に一度だけ warn を出す。
   * カウンタ自体は DO storage に載る state の一部で、KV write は増やさない。
   */
  private accumulateWrites(state: SyncState, writes: number): SyncState {
    if (writes <= 0) return state;
    const date = this.now().slice(0, 10);
    const prev =
      state.writeBudget && state.writeBudget.date === date
        ? state.writeBudget
        : { date, count: 0 };
    const nextCount = prev.count + writes;
    const threshold = this.dailyWriteBudget * this.writeBudgetWarnRatio;
    if (prev.count <= threshold && nextCount > threshold) {
      this.deps.logger?.warn?.("KV write が日次ソフト上限に接近しています", {
        operation: "writeBudget",
        date,
        count: nextCount,
        budget: this.dailyWriteBudget,
      });
    }
    return { ...state, writeBudget: { date, count: nextCount } };
  }

  async getState(): Promise<SyncState> {
    const raw = await this.scheduler.getState();
    return raw ? (raw as unknown as SyncState) : EMPTY_STATE;
  }

  private async setState(state: SyncState): Promise<void> {
    await this.scheduler.setState(toJsonState(state));
  }

  /** 初回 kick(コールドスタート)または CLI `nhc sync` からの手動 kick。 */
  async kick(): Promise<void> {
    await this.runChunk();
  }

  /** webhook 受信時に呼ぶ。debounce(数秒)して 1 回だけ同期を走らせる。 */
  async onWebhook(): Promise<void> {
    await this.scheduler.schedule(this.debounceMs, () => this.runChunk());
  }

  /**
   * Cron Trigger 等の補助経路から呼ぶ、定期リコンサイル。
   *
   * Notion 側に無くなった slug を index から削除する「削除検知」のみを行い、
   * Notion 側の新規・更新分を取り込む(materialize する)ことはしない。取り込みは
   * `kick()`/`onWebhook()`(内部で `runChunk()` を呼ぶ経路)の役目。ストレージ
   * フォーマット移行直後など index が空の状態でこれだけを呼んでも、コンテンツは
   * 復元されない点に注意。
   */
  async reconcile(): Promise<{ removed: readonly string[] }> {
    // `runChunk` の実行区間と直列化するため、実行中のジョブがあればその完了を待ってから始める。
    return this.runExclusive(() => this.reconcileOnce());
  }

  private async reconcileOnce(): Promise<{ removed: readonly string[] }> {
    const [allSlugs, indexedSlugs] = await Promise.all([
      this.deps.listAllSlugs(),
      this.deps.listIndexedSlugs(),
    ]);
    const current = new Set(allSlugs);
    const removed = indexedSlugs.filter((slug) => !current.has(slug));
    let writes = 0;
    for (const slug of removed) {
      const result = await this.deps.removeEntry(slug);
      writes += result?.writes ?? 0;
    }
    const state = await this.getState();
    await this.setState(
      this.accumulateWrites({ ...state, lastReconcileAt: this.now() }, writes),
    );
    return { removed };
  }

  private async runChunk(): Promise<void> {
    if (this.running) {
      this.rerunRequested = true;
      return;
    }
    this.running = true;
    try {
      do {
        this.rerunRequested = false;
        // `reconcile()` の実行区間と直列化するため、実際の処理はキューに乗せて実行する。
        await this.runExclusive(() => this.runChunkOnce());
      } while (this.rerunRequested);
    } finally {
      this.running = false;
    }
  }

  /**
   * `runChunk`/`reconcile` の実行区間そのものを直列化する。`queue` に繋ぐことで、
   * 先行するジョブ(どちらの種類でも)が完了するまで `fn` の開始を遅らせる。
   */
  private runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.queue.then(fn, fn);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async runChunkOnce(): Promise<void> {
    const state = await this.getState();

    let changes: readonly EntryChange[];
    let nextCursor: string | null;
    try {
      ({ changes, nextCursor } = await this.deps.listChanged(
        state.cursor,
        this.chunkSize,
      ));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.deps.logger?.error?.("同期の listChanged に失敗しました", {
        operation: "listChanged",
        error: message,
      });
      await this.setState({
        ...state,
        failures: [
          ...state.failures,
          { slug: "(listChanged)", message, at: this.now() },
        ],
      });
      // Notion クエリ自体の失敗は fail-soft: 諦めずに次チャンクを再スケジュールする。
      await this.scheduler.schedule(this.chunkDelayMs, () => this.runChunk());
      return;
    }

    const failures = [...state.failures];
    let writes = 0;

    for (const change of changes) {
      try {
        const result = await this.deps.syncEntry(change);
        writes += result?.writes ?? 0;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.deps.logger?.warn?.("entry の同期に失敗しました", {
          operation: "syncEntry",
          slug: change.slug,
          error: message,
        });
        failures.push({ slug: change.slug, message, at: this.now() });
      }
    }

    await this.setState(
      this.accumulateWrites(
        {
          cursor: nextCursor,
          lastSyncAt: this.now(),
          lastReconcileAt: state.lastReconcileAt,
          failures,
          writeBudget: state.writeBudget ?? null,
        },
        writes,
      ),
    );

    if (nextCursor !== null) {
      await this.scheduler.schedule(this.chunkDelayMs, () => this.runChunk());
    }
  }
}
