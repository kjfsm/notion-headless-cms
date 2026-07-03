import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EntryChange, SyncCoordinatorDeps } from "../coordinator.js";
import { SyncCoordinatorCore } from "../coordinator.js";
import { createNodeSyncScheduler } from "../node-scheduler.js";

function change(slug: string): EntryChange {
  return { slug, lastEditedTime: "2026-01-01T00:00:00.000Z" };
}

describe("SyncCoordinatorCore", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("chunkSize 単位で問い合わせ、nextCursor がある限り自己継続する", async () => {
    const pages: Record<
      string,
      { changes: EntryChange[]; nextCursor: string | null }
    > = {
      root: { changes: [change("a"), change("b")], nextCursor: "p1" },
      p1: { changes: [change("c"), change("d")], nextCursor: "p2" },
      p2: { changes: [change("e")], nextCursor: null },
    };
    const synced: string[] = [];
    const deps: SyncCoordinatorDeps = {
      listChanged: async (cursor) =>
        pages[cursor ?? "root"] ?? { changes: [], nextCursor: null },
      listAllSlugs: async () => [],
      listIndexedSlugs: async () => [],
      syncEntry: async (c) => {
        synced.push(c.slug);
      },
      removeEntry: async () => {},
      chunkSize: 2,
      chunkDelayMs: 100,
    };
    const scheduler = createNodeSyncScheduler();
    const coordinator = new SyncCoordinatorCore(scheduler, deps);

    await coordinator.kick();
    expect(synced).toEqual(["a", "b"]);

    await vi.advanceTimersByTimeAsync(100);
    expect(synced).toEqual(["a", "b", "c", "d"]);

    await vi.advanceTimersByTimeAsync(100);
    expect(synced).toEqual(["a", "b", "c", "d", "e"]);

    // nextCursor が null になったので、これ以上は自己継続しない。
    await vi.advanceTimersByTimeAsync(1000);
    expect(synced).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("同一ページの連続 webhook イベントは 1 回だけ同期を走らせる(debounce + dedupe)", async () => {
    const synced: string[] = [];
    const deps: SyncCoordinatorDeps = {
      listChanged: async () => ({ changes: [change("a")], nextCursor: null }),
      listAllSlugs: async () => [],
      listIndexedSlugs: async () => [],
      syncEntry: async (c) => {
        synced.push(c.slug);
      },
      removeEntry: async () => {},
      debounceMs: 3000,
    };
    const scheduler = createNodeSyncScheduler();
    const coordinator = new SyncCoordinatorCore(scheduler, deps);

    await coordinator.onWebhook();
    await vi.advanceTimersByTimeAsync(1000);
    await coordinator.onWebhook(); // debounce window 内の再イベント → 予約を置き換える
    await vi.advanceTimersByTimeAsync(1000);
    await coordinator.onWebhook();
    await vi.advanceTimersByTimeAsync(3000);

    expect(synced).toEqual(["a"]); // 3 イベントに対し同期は 1 回だけ
  });

  it("fail-soft: 1 entry の失敗は他の entry の処理を止めず、失敗が state に記録される", async () => {
    const synced: string[] = [];
    const deps: SyncCoordinatorDeps = {
      listChanged: async () => ({
        changes: [change("ok-1"), change("broken"), change("ok-2")],
        nextCursor: null,
      }),
      listAllSlugs: async () => [],
      listIndexedSlugs: async () => [],
      syncEntry: async (c) => {
        if (c.slug === "broken") throw new Error("sync failed");
        synced.push(c.slug);
      },
      removeEntry: async () => {},
      chunkSize: 10,
    };
    const scheduler = createNodeSyncScheduler();
    const coordinator = new SyncCoordinatorCore(scheduler, deps);

    await coordinator.kick();
    expect(synced).toEqual(["ok-1", "ok-2"]);

    const state = await coordinator.getState();
    expect(state.failures).toHaveLength(1);
    expect(state.failures[0]?.slug).toBe("broken");
  });

  it("reconcile は index にあって Notion 側に無い slug を検知して除去する(削除検知)", async () => {
    const removed: string[] = [];
    const deps: SyncCoordinatorDeps = {
      listChanged: async () => ({ changes: [], nextCursor: null }),
      listAllSlugs: async () => ["a", "b"],
      listIndexedSlugs: async () => ["a", "b", "c-deleted"],
      syncEntry: async () => {},
      removeEntry: async (slug) => {
        removed.push(slug);
      },
    };
    const scheduler = createNodeSyncScheduler();
    const coordinator = new SyncCoordinatorCore(scheduler, deps);

    const result = await coordinator.reconcile();
    expect(result.removed).toEqual(["c-deleted"]);
    expect(removed).toEqual(["c-deleted"]);

    const state = await coordinator.getState();
    expect(state.lastReconcileAt).not.toBeNull();
  });

  it("listChanged が失敗しても次チャンクへ再スケジュールされる(fail-soft)", async () => {
    let attempt = 0;
    const synced: string[] = [];
    const deps: SyncCoordinatorDeps = {
      listChanged: async () => {
        attempt++;
        if (attempt === 1) throw new Error("notion query failed");
        return { changes: [change("a")], nextCursor: null };
      },
      listAllSlugs: async () => [],
      listIndexedSlugs: async () => [],
      syncEntry: async (c) => {
        synced.push(c.slug);
      },
      removeEntry: async () => {},
      chunkDelayMs: 100,
    };
    const scheduler = createNodeSyncScheduler();
    const coordinator = new SyncCoordinatorCore(scheduler, deps);

    await coordinator.kick();
    expect(synced).toEqual([]);
    const state = await coordinator.getState();
    expect(state.failures).toHaveLength(1);
    expect(state.failures[0]?.slug).toBe("(listChanged)");

    await vi.advanceTimersByTimeAsync(100);
    expect(synced).toEqual(["a"]);
  });

  it("runChunk 実行中に再度呼ばれても取りこぼさず直列に処理する(再入防止ガード)", async () => {
    let resolveFirst:
      | ((v: { changes: EntryChange[]; nextCursor: string | null }) => void)
      | undefined;
    const firstGate = new Promise<{
      changes: EntryChange[];
      nextCursor: string | null;
    }>((resolve) => {
      resolveFirst = resolve;
    });
    let callCount = 0;
    const synced: string[] = [];
    const deps: SyncCoordinatorDeps = {
      listChanged: async () => {
        callCount++;
        if (callCount === 1) return firstGate;
        return { changes: [change("b")], nextCursor: null };
      },
      listAllSlugs: async () => [],
      listIndexedSlugs: async () => [],
      syncEntry: async (c) => {
        synced.push(c.slug);
      },
      removeEntry: async () => {},
    };
    const scheduler = createNodeSyncScheduler();
    const coordinator = new SyncCoordinatorCore(scheduler, deps);

    const p1 = coordinator.kick();
    const p2 = coordinator.kick(); // 1回目が listChanged 待ちの間に呼ばれる
    resolveFirst?.({ changes: [change("a")], nextCursor: null });
    await Promise.all([p1, p2]);

    expect(synced).toEqual(["a", "b"]); // 同時実行にならず両方処理される
    expect(callCount).toBe(2);
  });

  it("reconcile は削除が無ければ何もしない", async () => {
    const deps: SyncCoordinatorDeps = {
      listChanged: async () => ({ changes: [], nextCursor: null }),
      listAllSlugs: async () => ["a", "b"],
      listIndexedSlugs: async () => ["a", "b"],
      syncEntry: async () => {},
      removeEntry: async () => {
        throw new Error("should not be called");
      },
    };
    const scheduler = createNodeSyncScheduler();
    const coordinator = new SyncCoordinatorCore(scheduler, deps);
    const result = await coordinator.reconcile();
    expect(result.removed).toEqual([]);
  });
});
