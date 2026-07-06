import type { SyncState } from "@notion-headless-cms/cms";

export interface SyncCommandResult {
  readonly ok: boolean;
  readonly state: SyncState;
}

/**
 * `runSyncCommand` が必要とする最小限の構造型。`SyncCoordinatorCore` はもちろん、
 * `createCMS()` が返す `sync`(`CMSSyncControls`)もこの形を満たす。
 */
export interface SyncCommandCoordinator {
  kick(): Promise<void>;
  getState(): Promise<SyncState>;
}

/**
 * `nhc sync`: SyncCoordinator への手動 kick(初回 kick 経路)。
 * CLI は 1 回のプロセス実行で完結させたいため、`SyncScheduler.schedule` による
 * 自己継続(Alarm/setTimeout 待ち)には頼らず、`cursor` が尽きるまで `kick()` を
 * 直接ループ呼び出しする(Worker 内の chunked sync とは異なる、CLI 向けの完了待ち方式)。
 */
export async function runSyncCommand(
  coordinator: SyncCommandCoordinator,
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
