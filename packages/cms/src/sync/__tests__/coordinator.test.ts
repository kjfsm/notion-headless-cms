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
    const pages: Record<string, { changes: EntryChange[]; nextCursor: string | null }> = {
      root: { changes: [change("a"), change("b")], nextCursor: "p1" },
      p1: { changes: [change("c"), change("d")], nextCursor: "p2" },
      p2: { changes: [change("e")], nextCursor: null },
    };
    const synced: string[] = [];
    const deps: SyncCoordinatorDeps = {
      listChanged: async (cursor) => pages[cursor ?? "root"] ?? { changes: [], nextCursor: null },
      listAllSlugs: async () => [],
      listIndexedSlugs: async () => [],
      syncEntry: async (c) => {
        synced.push(c.slug);
        return { writes: 0 };
      },
      removeEntry: async () => ({ writes: 0 }),
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
        return { writes: 0 };
      },
      removeEntry: async () => ({ writes: 0 }),
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
        return { writes: 0 };
      },
      removeEntry: async () => ({ writes: 0 }),
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
      syncEntry: async () => ({ writes: 0 }),
      removeEntry: async (slug) => {
        removed.push(slug);
        return { writes: 0 };
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
        return { writes: 0 };
      },
      removeEntry: async () => ({ writes: 0 }),
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
        return { writes: 0 };
      },
      removeEntry: async () => ({ writes: 0 }),
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

  it("failures は無限に増え続けず直近 N 件のリングバッファに収まる", async () => {
    const deps: SyncCoordinatorDeps = {
      listChanged: async () => ({
        changes: [change("broken")],
        nextCursor: null,
      }),
      listAllSlugs: async () => [],
      listIndexedSlugs: async () => [],
      syncEntry: async () => {
        throw new Error("sync failed");
      },
      removeEntry: async () => ({ writes: 0 }),
      chunkSize: 1,
    };
    const scheduler = createNodeSyncScheduler();
    const coordinator = new SyncCoordinatorCore(scheduler, deps);

    // 上限(20件)を超える回数だけ失敗させる。
    for (let i = 0; i < 25; i++) {
      await coordinator.kick();
    }

    const state = await coordinator.getState();
    expect(state.failures.length).toBeLessThanOrEqual(20);
  });

  it("reconcile と runChunk が並行に呼ばれても state の read-modify-write が競合しない(直列化)", async () => {
    let resolveSync: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      resolveSync = resolve;
    });
    const deps: SyncCoordinatorDeps = {
      listChanged: async () => ({ changes: [change("a")], nextCursor: null }),
      listAllSlugs: async () => ["a"],
      listIndexedSlugs: async () => ["a", "gone"],
      syncEntry: async () => {
        await gate; // kick 側の state 書き込みを reconcile 呼び出しより後まで遅らせる
        return { writes: 3 };
      },
      removeEntry: async () => ({ writes: 5 }),
      now: () => "2026-07-05T00:00:00.000Z",
    };
    const coordinator = new SyncCoordinatorCore(createNodeSyncScheduler(), deps);

    const kickPromise = coordinator.kick(); // syncEntry の gate 待ちで setState 未実行のまま止まる
    await Promise.resolve();
    await Promise.resolve();
    const reconcilePromise = coordinator.reconcile(); // 直列化されていれば kick 完了まで開始を待つ

    resolveSync?.();
    await Promise.all([kickPromise, reconcilePromise]);

    const state = await coordinator.getState();
    // 直列化されていれば両方の writes(3+5=8)が state に反映される。
    // 競合すれば後勝ちで片方(3 または 5)だけが残ってしまう(lost update)。
    expect(state.writeBudget).toEqual({ date: "2026-07-05", count: 8 });
  });

  it("reconcile は削除が無ければ何もしない", async () => {
    const deps: SyncCoordinatorDeps = {
      listChanged: async () => ({ changes: [], nextCursor: null }),
      listAllSlugs: async () => ["a", "b"],
      listIndexedSlugs: async () => ["a", "b"],
      syncEntry: async () => ({ writes: 0 }),
      removeEntry: async () => {
        throw new Error("should not be called");
      },
    };
    const scheduler = createNodeSyncScheduler();
    const coordinator = new SyncCoordinatorCore(scheduler, deps);
    const result = await coordinator.reconcile();
    expect(result.removed).toEqual([]);
  });

  describe("writeBudget(KV write の日次計測)", () => {
    it("syncEntry が返す writes を当日ぶんとして加算する", async () => {
      const deps: SyncCoordinatorDeps = {
        listChanged: async () => ({
          changes: [change("a"), change("b")],
          nextCursor: null,
        }),
        listAllSlugs: async () => [],
        listIndexedSlugs: async () => [],
        syncEntry: async () => ({ writes: 2 }),
        removeEntry: async () => ({ writes: 0 }),
        chunkSize: 10,
        now: () => "2026-07-05T10:00:00.000Z",
      };
      const coordinator = new SyncCoordinatorCore(createNodeSyncScheduler(), deps);

      await coordinator.kick();
      const state = await coordinator.getState();
      expect(state.writeBudget).toEqual({ date: "2026-07-05", count: 4 });
    });

    it("reconcile の削除ぶんの writes も加算する", async () => {
      const deps: SyncCoordinatorDeps = {
        listChanged: async () => ({ changes: [], nextCursor: null }),
        listAllSlugs: async () => ["a"],
        listIndexedSlugs: async () => ["a", "gone"],
        syncEntry: async () => ({ writes: 0 }),
        removeEntry: async () => ({ writes: 2 }),
        now: () => "2026-07-05T03:00:00.000Z",
      };
      const coordinator = new SyncCoordinatorCore(createNodeSyncScheduler(), deps);

      await coordinator.reconcile();
      const state = await coordinator.getState();
      expect(state.writeBudget).toEqual({ date: "2026-07-05", count: 2 });
    });

    it("UTC 日付が変わると当日カウンタを 0 から数え直す", async () => {
      let today = "2026-07-05T23:00:00.000Z";
      const deps: SyncCoordinatorDeps = {
        listChanged: async () => ({ changes: [change("a")], nextCursor: null }),
        listAllSlugs: async () => [],
        listIndexedSlugs: async () => [],
        syncEntry: async () => ({ writes: 2 }),
        removeEntry: async () => ({ writes: 0 }),
        now: () => today,
      };
      const coordinator = new SyncCoordinatorCore(createNodeSyncScheduler(), deps);

      await coordinator.kick();
      expect((await coordinator.getState()).writeBudget).toEqual({
        date: "2026-07-05",
        count: 2,
      });

      today = "2026-07-06T00:30:00.000Z";
      await coordinator.kick();
      expect((await coordinator.getState()).writeBudget).toEqual({
        date: "2026-07-06",
        count: 2,
      });
    });

    it("ソフト上限を跨いだ時に一度だけ warn を出す", async () => {
      const warn = vi.fn();
      const deps: SyncCoordinatorDeps = {
        listChanged: async () => ({ changes: [change("a")], nextCursor: null }),
        listAllSlugs: async () => [],
        listIndexedSlugs: async () => [],
        syncEntry: async () => ({ writes: 5 }),
        removeEntry: async () => ({ writes: 0 }),
        dailyWriteBudget: 10, // 閾値 = 10 * 0.8 = 8
        writeBudgetWarnRatio: 0.8,
        now: () => "2026-07-05T10:00:00.000Z",
        logger: { warn },
      };
      const coordinator = new SyncCoordinatorCore(createNodeSyncScheduler(), deps);

      await coordinator.kick(); // 5 → 閾値 8 未満、warn 無し
      expect(warn).not.toHaveBeenCalled();

      await coordinator.kick(); // 10 → 閾値 8 超過、warn 1 回
      const budgetWarns = warn.mock.calls.filter(
        (c) => (c[1] as { operation?: string })?.operation === "writeBudget",
      );
      expect(budgetWarns).toHaveLength(1);

      await coordinator.kick(); // 15 → 既に閾値超過済み、追加の warn 無し
      const budgetWarnsAfter = warn.mock.calls.filter(
        (c) => (c[1] as { operation?: string })?.operation === "writeBudget",
      );
      expect(budgetWarnsAfter).toHaveLength(1);
    });
  });
});
