import type { SyncScheduler } from "../sync-scheduler.js";
import type { SyncFailure, WriteBudgetState } from "../sync/coordinator.js";
import { parseSyncState } from "../sync/coordinator.js";

export interface SyncStats {
  readonly lastSyncAt: string | null;
  readonly lastReconcileAt: string | null;
  /** 保持中の失敗件数（`coordinator.ts` の `MAX_FAILURES` で上限が掛かるリングバッファのサイズ）。 */
  readonly failureCount: number;
  readonly recentFailures: readonly SyncFailure[];
  /** 当日ぶんの KV write 累計（無料枠の予算監視用）。未同期なら null。 */
  readonly writeBudget: WriteBudgetState | null;
}

/**
 * 同期状態の観測面。読者 API から参照可能にし、doctor コマンド(#446)の材料にする。
 */
export async function getSyncStats(scheduler: SyncScheduler): Promise<SyncStats> {
  const state = parseSyncState(await scheduler.getState());
  return {
    lastSyncAt: state.lastSyncAt,
    lastReconcileAt: state.lastReconcileAt,
    failureCount: state.failures.length,
    recentFailures: state.failures.slice(-10),
    writeBudget: state.writeBudget ?? null,
  };
}
