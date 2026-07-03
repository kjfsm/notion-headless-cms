import type { SyncFailure, SyncState } from "../sync/coordinator.js";
import type { SyncScheduler } from "../sync-scheduler.js";

const EMPTY_STATE: SyncState = {
  cursor: null,
  lastSyncAt: null,
  lastReconcileAt: null,
  failures: [],
};

export interface SyncStats {
  readonly lastSyncAt: string | null;
  readonly lastReconcileAt: string | null;
  readonly failureCount: number;
  readonly recentFailures: readonly SyncFailure[];
}

/**
 * 同期状態の観測面。読者 API から参照可能にし、doctor コマンド(#446)の材料にする。
 */
export async function getSyncStats(
  scheduler: SyncScheduler,
): Promise<SyncStats> {
  const raw = await scheduler.getState();
  const state = raw ? (raw as unknown as SyncState) : EMPTY_STATE;
  return {
    lastSyncAt: state.lastSyncAt,
    lastReconcileAt: state.lastReconcileAt,
    failureCount: state.failures.length,
    recentFailures: state.failures.slice(-10),
  };
}
