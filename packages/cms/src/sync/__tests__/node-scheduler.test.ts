import { describe, expect, it, vi } from "vitest";

import { createNodeSyncScheduler } from "../node-scheduler.js";

describe("createNodeSyncScheduler", () => {
  it("schedule した task が delayMs 後に実行される", async () => {
    vi.useFakeTimers();
    const scheduler = createNodeSyncScheduler();
    const task = vi.fn(async () => {});
    await scheduler.schedule(100, task);
    expect(task).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(task).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("再度 schedule すると既存の予約を置き換える(debounce の基盤)", async () => {
    vi.useFakeTimers();
    const scheduler = createNodeSyncScheduler();
    const first = vi.fn(async () => {});
    const second = vi.fn(async () => {});
    await scheduler.schedule(100, first);
    await vi.advanceTimersByTimeAsync(50);
    await scheduler.schedule(100, second);
    await vi.advanceTimersByTimeAsync(100);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("cancel すると予約された task は実行されない", async () => {
    vi.useFakeTimers();
    const scheduler = createNodeSyncScheduler();
    const task = vi.fn(async () => {});
    await scheduler.schedule(100, task);
    await scheduler.cancel();
    await vi.advanceTimersByTimeAsync(200);
    expect(task).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("getState/setState が round trip する", async () => {
    const scheduler = createNodeSyncScheduler();
    expect(await scheduler.getState()).toBeNull();
    await scheduler.setState({ cursor: "abc" });
    expect(await scheduler.getState()).toEqual({ cursor: "abc" });
  });
});
