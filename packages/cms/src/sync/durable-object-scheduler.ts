import type { SyncScheduler } from "../sync-scheduler.js";
import type { JsonValue } from "../types/json-value.js";

/** Durable Object storage の最小構造型(`@cloudflare/workers-types` に実依存しない)。 */
export interface DurableObjectStorageLike {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  setAlarm(scheduledTime: number): Promise<void>;
  deleteAlarm(): Promise<void>;
}

export interface DurableObjectStateLike {
  readonly storage: DurableObjectStorageLike;
}

const STATE_KEY = "sync:state";

/**
 * Durable Object storage を使う `SyncScheduler` 実装。
 *
 * 注意: DO インスタンスは Alarm 発火の間にエビクトされ得るため、`schedule` に渡した
 * `task` クロージャは同一インスタンスが生き続ける間のみ有効という前提を置いている。
 * 実際の `SyncCoordinatorDO`(#443 で結線)は `alarm()` ハンドラ内で
 * coordinator を都度再構築し `kick()` を呼ぶ設計にすることで、エビクト後も
 * 継続処理できるようにする。ここでの `task` 保持はホットパス(同一バースト内の
 * 連続実行)の最適化であり、正しさの前提ではない。
 */
export function createDurableObjectSyncScheduler(state: DurableObjectStateLike): SyncScheduler {
  return {
    async schedule(delayMs, _task) {
      await state.storage.setAlarm(Date.now() + delayMs);
    },
    async cancel() {
      await state.storage.deleteAlarm();
    },
    async getState() {
      const raw = await state.storage.get<Record<string, JsonValue>>(STATE_KEY);
      return raw ?? null;
    },
    async setState(next) {
      await state.storage.put(STATE_KEY, next);
    },
  };
}
