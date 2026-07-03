import type { SyncScheduler } from "../sync-scheduler.js";
import type { JsonValue } from "../types/json-value.js";

/**
 * Node ランタイム向け `SyncScheduler`(`setTimeout` ベース)。
 * Cloudflare 実装(DO Alarm)と同一契約を満たす最小実装(優先度低・契約テストを通す目的)。
 * 同時実行防止は `SyncCoordinatorCore` 側の再入防止ガードが担うため、ここでは
 * 「直前の予約を置き換える」以上のことはしない(mutex は持たない)。
 */
export function createNodeSyncScheduler(): SyncScheduler {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let state: Readonly<Record<string, JsonValue>> | null = null;

  return {
    async schedule(delayMs, task) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        void task();
      }, delayMs);
      // Node の setTimeout はプロセスを生かし続けるため、テスト等で明示終了したい場合に備えて unref する。
      timer.unref?.();
    },
    async cancel() {
      if (timer) clearTimeout(timer);
      timer = undefined;
    },
    async getState() {
      return state;
    },
    async setState(next) {
      state = next;
    },
  };
}
