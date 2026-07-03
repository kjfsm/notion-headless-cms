import type {
  SyncCoordinatorDeps,
  SyncScheduler,
} from "@notion-headless-cms/cms";
import { SyncCoordinatorCore } from "@notion-headless-cms/cms";
import { describe, expect, it } from "vitest";
import { runSyncCommand } from "../sync-command.js";

function makeMemoryScheduler(): SyncScheduler {
  let state: Record<string, unknown> | null = null;
  return {
    async schedule() {
      // runSyncCommand は scheduler の自己継続を使わず明示ループで駆動するため、
      // ここでは何もしない(実際の DO/Node スケジューラの遅延実行を模倣しない)。
    },
    async cancel() {},
    async getState() {
      return state as never;
    },
    async setState(next) {
      state = next as never;
    },
  };
}

describe("runSyncCommand", () => {
  it("cursor が尽きるまで kick を繰り返し、完了後の state を返す", async () => {
    const pages: Record<
      string,
      {
        changes: { slug: string; lastEditedTime: string }[];
        nextCursor: string | null;
      }
    > = {
      root: { changes: [{ slug: "a", lastEditedTime: "t" }], nextCursor: "p1" },
      p1: { changes: [{ slug: "b", lastEditedTime: "t" }], nextCursor: null },
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
      chunkSize: 1,
    };
    const coordinator = new SyncCoordinatorCore(makeMemoryScheduler(), deps);
    const result = await runSyncCommand(coordinator);
    expect(synced).toEqual(["a", "b"]);
    expect(result.ok).toBe(true);
    expect(result.state.cursor).toBeNull();
  });

  it("同期失敗があれば ok: false を返す", async () => {
    const deps: SyncCoordinatorDeps = {
      listChanged: async () => ({
        changes: [{ slug: "broken", lastEditedTime: "t" }],
        nextCursor: null,
      }),
      listAllSlugs: async () => [],
      listIndexedSlugs: async () => [],
      syncEntry: async () => {
        throw new Error("boom");
      },
      removeEntry: async () => {},
    };
    const coordinator = new SyncCoordinatorCore(makeMemoryScheduler(), deps);
    const result = await runSyncCommand(coordinator);
    expect(result.ok).toBe(false);
    expect(result.state.failures).toHaveLength(1);
  });

  it("onProgress が各サイクルで呼ばれる", async () => {
    const pages: Record<
      string,
      {
        changes: { slug: string; lastEditedTime: string }[];
        nextCursor: string | null;
      }
    > = {
      root: { changes: [{ slug: "a", lastEditedTime: "t" }], nextCursor: "p1" },
      p1: { changes: [], nextCursor: null },
    };
    const deps: SyncCoordinatorDeps = {
      listChanged: async (cursor) =>
        pages[cursor ?? "root"] ?? { changes: [], nextCursor: null },
      listAllSlugs: async () => [],
      listIndexedSlugs: async () => [],
      syncEntry: async () => {},
      removeEntry: async () => {},
      chunkSize: 1,
    };
    const coordinator = new SyncCoordinatorCore(makeMemoryScheduler(), deps);
    const progressCalls: unknown[] = [];
    await runSyncCommand(coordinator, (state) => progressCalls.push(state));
    expect(progressCalls.length).toBeGreaterThanOrEqual(2);
  });
});
