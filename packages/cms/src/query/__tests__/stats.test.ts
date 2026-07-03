import { describe, expect, it } from "vitest";
import { createNodeSyncScheduler } from "../../sync/node-scheduler.js";
import { getSyncStats } from "../stats.js";

describe("getSyncStats", () => {
  it("state 未設定なら既定値を返す", async () => {
    const scheduler = createNodeSyncScheduler();
    const stats = await getSyncStats(scheduler);
    expect(stats).toEqual({
      lastSyncAt: null,
      lastReconcileAt: null,
      failureCount: 0,
      recentFailures: [],
    });
  });

  it("state から失敗件数・直近失敗を読み出す", async () => {
    const scheduler = createNodeSyncScheduler();
    await scheduler.setState({
      cursor: null,
      lastSyncAt: "2026-01-01T00:00:00.000Z",
      lastReconcileAt: null,
      failures: [
        { slug: "a", message: "boom", at: "2026-01-01T00:00:00.000Z" },
      ],
    });
    const stats = await getSyncStats(scheduler);
    expect(stats.lastSyncAt).toBe("2026-01-01T00:00:00.000Z");
    expect(stats.failureCount).toBe(1);
    expect(stats.recentFailures[0]?.slug).toBe("a");
  });
});
