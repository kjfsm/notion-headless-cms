import type { SyncCoordinatorCore, SyncState } from "@notion-headless-cms/cms";

export interface SyncCommandResult {
  readonly ok: boolean;
  readonly state: SyncState;
}

/**
 * `nhc sync`: SyncCoordinator への手動 kick(初回 kick 経路)。
 * CLI は 1 回のプロセス実行で完結させたいため、`SyncScheduler.schedule` による
 * 自己継続(Alarm/setTimeout 待ち)には頼らず、`cursor` が尽きるまで `kick()` を
 * 直接ループ呼び出しする(Worker 内の chunked sync とは異なる、CLI 向けの完了待ち方式)。
 */
export async function runSyncCommand(
  coordinator: SyncCoordinatorCore,
  onProgress?: (state: SyncState) => void,
): Promise<SyncCommandResult> {
  let state = await coordinator.getState();
  do {
    await coordinator.kick();
    state = await coordinator.getState();
    onProgress?.(state);
  } while (state.cursor !== null);
  return { ok: state.failures.length === 0, state };
}
