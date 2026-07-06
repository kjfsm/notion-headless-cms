import { describe, expect, it } from "vitest";

import type { DurableObjectStateLike } from "../durable-object-scheduler.js";
import { createDurableObjectSyncScheduler } from "../durable-object-scheduler.js";

function fakeState(): DurableObjectStateLike & {
  alarms: number[];
  deleted: number;
} {
  const map = new Map<string, unknown>();
  const alarms: number[] = [];
  let deleted = 0;
  return {
    alarms,
    get deleted() {
      return deleted;
    },
    storage: {
      async get<T>(key: string) {
        return map.get(key) as T | undefined;
      },
      async put<T>(key: string, value: T) {
        map.set(key, value);
      },
      async setAlarm(time: number) {
        alarms.push(time);
      },
      async deleteAlarm() {
        deleted++;
      },
    },
  };
}

describe("createDurableObjectSyncScheduler", () => {
  it("schedule は storage.setAlarm を delayMs 後の時刻で呼ぶ", async () => {
    const state = fakeState();
    const scheduler = createDurableObjectSyncScheduler(state);
    const before = Date.now();
    await scheduler.schedule(1000, async () => {});
    expect(state.alarms).toHaveLength(1);
    expect(state.alarms[0]).toBeGreaterThanOrEqual(before + 1000);
  });

  it("cancel は storage.deleteAlarm を呼ぶ", async () => {
    const state = fakeState();
    const scheduler = createDurableObjectSyncScheduler(state);
    await scheduler.cancel();
    expect(state.deleted).toBe(1);
  });

  it("getState/setState が storage.get/put を通じて round trip する", async () => {
    const state = fakeState();
    const scheduler = createDurableObjectSyncScheduler(state);
    expect(await scheduler.getState()).toBeNull();
    await scheduler.setState({ cursor: "abc" });
    expect(await scheduler.getState()).toEqual({ cursor: "abc" });
  });
});
