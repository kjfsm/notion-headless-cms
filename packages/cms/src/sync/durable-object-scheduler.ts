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
 * 注意: `schedule` に渡された `task` クロージャは保持しない(`setAlarm` を
 * 予約するのみ)。DO インスタンスは Alarm 発火の間にエビクトされ得るうえ、
 * そもそも関数はシリアライズ不可能なため、storage 越しに `task` を持ち越す
 * ことは原理的にできない。実際の起動は `alarm()` ハンドラの役目で、
 * `SyncCoordinatorDO`(`sync-coordinator-do.ts`)がコンストラクタで
 * `options.createCMS` を呼び直して coordinator を再構築し、`alarm()` から
 * `kick()` を呼ぶことでエビクト後も継続処理できるようにしている。
 */
export function createDurableObjectSyncScheduler(
  state: DurableObjectStateLike,
): SyncScheduler {
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
