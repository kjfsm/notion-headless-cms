import type { SyncScheduler } from "../sync-scheduler.js";
import type { JsonValue } from "../types/json-value.js";

export interface EntryChange {
  readonly slug: string;
  readonly lastEditedTime: string;
}

export interface SyncFailure {
  readonly slug: string;
  readonly message: string;
  readonly at: string;
}

export interface SyncState {
  readonly cursor: string | null;
  readonly lastSyncAt: string | null;
  readonly lastReconcileAt: string | null;
  readonly failures: readonly SyncFailure[];
}

const EMPTY_STATE: SyncState = {
  cursor: null,
  lastSyncAt: null,
  lastReconcileAt: null,
  failures: [],
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
  /** 1 entry を実際に同期する(パイプライン実行 + ストア書き込み)。 */
  syncEntry(change: EntryChange): Promise<void>;
  /** 削除・非公開化された slug を index から除去する。 */
  removeEntry(slug: string): Promise<void>;
  /** 1 サイクルあたり処理する entry 数(chunked sync の粒度)。既定 2。 */
  chunkSize?: number;
  /** 次チャンクまでの待機時間(ms)。既定 300ms。 */
  chunkDelayMs?: number;
  /** webhook debounce 時間(ms)。既定 3000ms。 */
  debounceMs?: number;
  now?: () => string;
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
 *   `SyncState.failures` に記録し、直前の正常 snapshot は上書きされない
 */
export class SyncCoordinatorCore {
  private readonly chunkSize: number;
  private readonly chunkDelayMs: number;
  private readonly debounceMs: number;
  private readonly now: () => string;

  constructor(
    private readonly scheduler: SyncScheduler,
    private readonly deps: SyncCoordinatorDeps,
  ) {
    this.chunkSize = deps.chunkSize ?? 2;
    this.chunkDelayMs = deps.chunkDelayMs ?? 300;
    this.debounceMs = deps.debounceMs ?? 3000;
    this.now = deps.now ?? (() => new Date().toISOString());
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

  /** Cron Trigger 等の補助経路から呼ぶ、定期フルリコンサイル。 */
  async reconcile(): Promise<{ removed: readonly string[] }> {
    const [allSlugs, indexedSlugs] = await Promise.all([
      this.deps.listAllSlugs(),
      this.deps.listIndexedSlugs(),
    ]);
    const current = new Set(allSlugs);
    const removed = indexedSlugs.filter((slug) => !current.has(slug));
    for (const slug of removed) {
      await this.deps.removeEntry(slug);
    }
    const state = await this.getState();
    await this.setState({ ...state, lastReconcileAt: this.now() });
    return { removed };
  }

  private async runChunk(): Promise<void> {
    const state = await this.getState();
    const { changes, nextCursor } = await this.deps.listChanged(
      state.cursor,
      this.chunkSize,
    );
    const failures = [...state.failures];

    for (const change of changes) {
      try {
        await this.deps.syncEntry(change);
      } catch (err) {
        failures.push({
          slug: change.slug,
          message: err instanceof Error ? err.message : String(err),
          at: this.now(),
        });
      }
    }

    await this.setState({
      cursor: nextCursor,
      lastSyncAt: this.now(),
      lastReconcileAt: state.lastReconcileAt,
      failures,
    });

    if (nextCursor !== null) {
      await this.scheduler.schedule(this.chunkDelayMs, () => this.runChunk());
    }
  }
}
