import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EntryChange } from "../coordinator.js";
import { SyncCoordinatorCore } from "../coordinator.js";
import { createMultiSourceDeps } from "../multi-source.js";
import { createNodeSyncScheduler } from "../node-scheduler.js";
import type { CollectionDriver } from "../notion-driver.js";

/** テスト用の単純な in-memory ドライバ。件数分の EntryChange を順番に返す。 */
function makeFakeDriver(opts: {
  changes: readonly EntryChange[];
  allSlugs?: readonly string[];
  indexedSlugs?: readonly string[];
}): {
  driver: CollectionDriver;
  syncEntry: ReturnType<typeof vi.fn>;
  removeEntry: ReturnType<typeof vi.fn>;
} {
  const syncEntry = vi.fn().mockResolvedValue(undefined);
  const removeEntry = vi.fn().mockResolvedValue(undefined);
  const driver: CollectionDriver = {
    async listChanged(cursor, limit) {
      const offset = cursor ? Number(cursor) : 0;
      const page = opts.changes.slice(offset, offset + limit);
      const nextOffset = offset + page.length;
      return {
        changes: page,
        nextCursor: nextOffset < opts.changes.length ? String(nextOffset) : null,
      };
    },
    async listAllSlugs() {
      return opts.allSlugs ?? [];
    },
    async listIndexedSlugs() {
      return opts.indexedSlugs ?? [];
    },
    syncEntry,
    removeEntry,
    async retrieveBySlug() {
      return null;
    },
  };
  return { driver, syncEntry, removeEntry };
}

describe("createMultiSourceDeps", () => {
  it("1 コレクション分のカーソルが尽きたら同一呼び出し内で次のコレクションへ遷移する", async () => {
    const posts = makeFakeDriver({
      changes: [
        { slug: "a", lastEditedTime: "t1" },
        { slug: "b", lastEditedTime: "t2" },
      ],
    });
    const news = makeFakeDriver({
      changes: [{ slug: "c", lastEditedTime: "t3" }],
    });
    const deps = createMultiSourceDeps({
      drivers: { posts: posts.driver, news: news.driver },
    });

    const result = await deps.listChanged(null, 5);
    expect(result.changes).toEqual([
      { slug: "posts:a", lastEditedTime: "t1" },
      { slug: "posts:b", lastEditedTime: "t2" },
      { slug: "news:c", lastEditedTime: "t3" },
    ]);
    expect(result.nextCursor).toBeNull();
  });

  it("limit に達したら現在のコレクションのカーソルを JSON で保持する", async () => {
    const posts = makeFakeDriver({
      changes: [
        { slug: "a", lastEditedTime: "t1" },
        { slug: "b", lastEditedTime: "t2" },
        { slug: "c", lastEditedTime: "t3" },
      ],
    });
    const deps = createMultiSourceDeps({ drivers: { posts: posts.driver } });

    const first = await deps.listChanged(null, 2);
    expect(first.changes).toEqual([
      { slug: "posts:a", lastEditedTime: "t1" },
      { slug: "posts:b", lastEditedTime: "t2" },
    ]);
    expect(first.nextCursor).not.toBeNull();
    expect(JSON.parse(first.nextCursor as string)).toEqual({
      c: "posts",
      nc: "2",
    });

    const second = await deps.listChanged(first.nextCursor, 2);
    expect(second.changes).toEqual([{ slug: "posts:c", lastEditedTime: "t3" }]);
    expect(second.nextCursor).toBeNull();
  });

  it("cursor が壊れている(JSON.parse 失敗)場合は先頭から同期をやり直す", async () => {
    const posts = makeFakeDriver({
      changes: [{ slug: "a", lastEditedTime: "t1" }],
    });
    const warn = vi.fn();
    const deps = createMultiSourceDeps({
      drivers: { posts: posts.driver },
      logger: { warn },
    });

    // 旧フォーマット(素の Notion カーソル文字列)や破損値を想定した不正 JSON。
    const result = await deps.listChanged("not-json{{", 10);

    expect(result.changes).toEqual([{ slug: "posts:a", lastEditedTime: "t1" }]);
    expect(warn).toHaveBeenCalled();
  });

  it("cursor の形式が不正(想定外の shape)な場合も先頭から同期をやり直す", async () => {
    const posts = makeFakeDriver({
      changes: [{ slug: "a", lastEditedTime: "t1" }],
    });
    const deps = createMultiSourceDeps({ drivers: { posts: posts.driver } });

    const result = await deps.listChanged(JSON.stringify({ foo: "bar" }), 10);

    expect(result.changes).toEqual([{ slug: "posts:a", lastEditedTime: "t1" }]);
  });

  it("コレクション境界を跨いで limit ちょうどで打ち切ると次コレクション先頭のカーソルを返す", async () => {
    const posts = makeFakeDriver({
      changes: [{ slug: "a", lastEditedTime: "t1" }],
    });
    const news = makeFakeDriver({
      changes: [{ slug: "b", lastEditedTime: "t2" }],
    });
    const deps = createMultiSourceDeps({
      drivers: { posts: posts.driver, news: news.driver },
    });

    const first = await deps.listChanged(null, 1);
    expect(first.changes).toEqual([{ slug: "posts:a", lastEditedTime: "t1" }]);
    expect(JSON.parse(first.nextCursor as string)).toEqual({
      c: "news",
      nc: null,
    });

    const second = await deps.listChanged(first.nextCursor, 1);
    expect(second.changes).toEqual([{ slug: "news:b", lastEditedTime: "t2" }]);
    expect(second.nextCursor).toBeNull();
  });

  it("listAllSlugs は各コレクションの slug に名前空間を付けて連結する", async () => {
    const posts = makeFakeDriver({ changes: [], allSlugs: ["a", "b"] });
    const news = makeFakeDriver({ changes: [], allSlugs: ["c"] });
    const deps = createMultiSourceDeps({
      drivers: { posts: posts.driver, news: news.driver },
    });
    expect(await deps.listAllSlugs()).toEqual(["posts:a", "posts:b", "news:c"]);
  });

  it("listIndexedSlugs も同様に名前空間を付けて連結する", async () => {
    const posts = makeFakeDriver({ changes: [], indexedSlugs: ["x"] });
    const news = makeFakeDriver({ changes: [], indexedSlugs: ["y", "z"] });
    const deps = createMultiSourceDeps({
      drivers: { posts: posts.driver, news: news.driver },
    });
    expect(await deps.listIndexedSlugs()).toEqual(["posts:x", "news:y", "news:z"]);
  });

  it("syncEntry は名前空間を解いて対応するコレクションのドライバに委譲する", async () => {
    const posts = makeFakeDriver({ changes: [] });
    const news = makeFakeDriver({ changes: [] });
    const deps = createMultiSourceDeps({
      drivers: { posts: posts.driver, news: news.driver },
    });
    await deps.syncEntry({ slug: "news:hello", lastEditedTime: "t1" });
    expect(news.syncEntry).toHaveBeenCalledWith({
      slug: "hello",
      lastEditedTime: "t1",
    });
    expect(posts.syncEntry).not.toHaveBeenCalled();
  });

  it("removeEntry も名前空間を解いて対応するコレクションのドライバに委譲する", async () => {
    const posts = makeFakeDriver({ changes: [] });
    const news = makeFakeDriver({ changes: [] });
    const deps = createMultiSourceDeps({
      drivers: { posts: posts.driver, news: news.driver },
    });
    await deps.removeEntry("posts:old");
    expect(posts.removeEntry).toHaveBeenCalledWith("old");
    expect(news.removeEntry).not.toHaveBeenCalled();
  });

  it("1 コレクションの syncEntry 失敗は他コレクションを止めない(fail-soft は呼び出し側の coordinator が担う)", async () => {
    const posts = makeFakeDriver({ changes: [] });
    posts.syncEntry.mockRejectedValueOnce(new Error("boom"));
    const deps = createMultiSourceDeps({ drivers: { posts: posts.driver } });
    await expect(deps.syncEntry({ slug: "posts:broken", lastEditedTime: "t1" })).rejects.toThrow(
      "boom",
    );
  });

  it("空の drivers では変化なしを返す", async () => {
    const deps = createMultiSourceDeps({ drivers: {} });
    const result = await deps.listChanged(null, 10);
    expect(result).toEqual({ changes: [], nextCursor: null });
  });

  describe("SyncCoordinatorCore との統合", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("複数コレクションの変更を chunkSize 単位で自己継続しながら同期する", async () => {
      const posts = makeFakeDriver({
        changes: [
          { slug: "a", lastEditedTime: "t1" },
          { slug: "b", lastEditedTime: "t2" },
        ],
      });
      const news = makeFakeDriver({
        changes: [{ slug: "c", lastEditedTime: "t3" }],
      });
      const deps = createMultiSourceDeps({
        drivers: { posts: posts.driver, news: news.driver },
      });
      const scheduler = createNodeSyncScheduler();
      const coordinator = new SyncCoordinatorCore(scheduler, {
        ...deps,
        chunkSize: 2,
        chunkDelayMs: 100,
      });

      await coordinator.kick();
      expect(posts.syncEntry).toHaveBeenCalledWith({
        slug: "a",
        lastEditedTime: "t1",
      });
      expect(posts.syncEntry).toHaveBeenCalledWith({
        slug: "b",
        lastEditedTime: "t2",
      });
      expect(news.syncEntry).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(100);
      expect(news.syncEntry).toHaveBeenCalledWith({
        slug: "c",
        lastEditedTime: "t3",
      });

      const state = await coordinator.getState();
      expect(state.cursor).toBeNull();
      expect(state.failures).toEqual([]);
    });

    it("reconcile は名前空間付きの集合差分で複数コレクション横断の削除を検知する", async () => {
      const posts = makeFakeDriver({
        changes: [],
        allSlugs: ["kept"],
        indexedSlugs: ["kept", "deleted-post"],
      });
      const news = makeFakeDriver({
        changes: [],
        allSlugs: [],
        indexedSlugs: ["deleted-news"],
      });
      const deps = createMultiSourceDeps({
        drivers: { posts: posts.driver, news: news.driver },
      });
      const scheduler = createNodeSyncScheduler();
      const coordinator = new SyncCoordinatorCore(scheduler, deps);

      const { removed } = await coordinator.reconcile();
      expect([...removed].sort()).toEqual(["news:deleted-news", "posts:deleted-post"]);
      expect(posts.removeEntry).toHaveBeenCalledWith("deleted-post");
      expect(news.removeEntry).toHaveBeenCalledWith("deleted-news");
    });

    it("1 コレクションの syncEntry 失敗は他コレクションを止めず fail-soft に記録される", async () => {
      const posts = makeFakeDriver({
        changes: [{ slug: "broken", lastEditedTime: "t1" }],
      });
      posts.syncEntry.mockRejectedValueOnce(new Error("boom"));
      const news = makeFakeDriver({
        changes: [{ slug: "ok", lastEditedTime: "t2" }],
      });
      const deps = createMultiSourceDeps({
        drivers: { posts: posts.driver, news: news.driver },
      });
      const scheduler = createNodeSyncScheduler();
      const coordinator = new SyncCoordinatorCore(scheduler, {
        ...deps,
        chunkSize: 10,
      });

      await coordinator.kick();
      expect(news.syncEntry).toHaveBeenCalledWith({
        slug: "ok",
        lastEditedTime: "t2",
      });
      const state = await coordinator.getState();
      expect(state.failures).toHaveLength(1);
      expect(state.failures[0]?.slug).toBe("posts:broken");
      expect(state.failures[0]?.message).toBe("boom");
    });
  });
});
