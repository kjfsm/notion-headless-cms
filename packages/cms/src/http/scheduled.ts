import type { SyncCoordinatorCore } from "../sync/coordinator.js";

/**
 * Cron Trigger(または Node の定期実行)から SyncCoordinator のリコンサイルを kick する補助経路。
 * `cms.scheduled(event)` として export する想定。
 */
export function createScheduledHandler(coordinator: SyncCoordinatorCore): () => Promise<void> {
  return async () => {
    await coordinator.reconcile();
  };
}
