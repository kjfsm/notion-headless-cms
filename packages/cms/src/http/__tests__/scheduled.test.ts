import { describe, expect, it, vi } from "vitest";

import type { SyncCoordinatorCore } from "../../sync/coordinator.js";
import { createScheduledHandler } from "../scheduled.js";

describe("createScheduledHandler", () => {
  it("coordinator.reconcile を呼ぶ", async () => {
    const reconcile = vi.fn().mockResolvedValue({ removed: [] });
    const coordinator = { reconcile } as unknown as SyncCoordinatorCore;
    const scheduled = createScheduledHandler(coordinator);
    await scheduled();
    expect(reconcile).toHaveBeenCalledTimes(1);
  });
});
