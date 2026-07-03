import { describe, expect, it, vi } from "vitest";
import type { RealtimeAdapter } from "../realtime.js";
import { channelTag, publishVersionUpdate } from "../realtime.js";

describe("channelTag", () => {
  it("slug ありは c:{collection}:{slug}", () => {
    expect(channelTag("posts", "hello")).toBe("c:posts:hello");
  });
  it("slug なしは c:{collection}", () => {
    expect(channelTag("posts")).toBe("c:posts");
  });
});

describe("publishVersionUpdate", () => {
  it("slug 指定時は item チャンネルと list チャンネルの両方に version 同梱で publish する", async () => {
    const publish = vi.fn();
    const realtime: RealtimeAdapter = { publish };
    await publishVersionUpdate(realtime, "posts", "hello", "v2");
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledWith("c:posts", {
      collection: "posts",
      slug: "hello",
      version: "v2",
    });
    expect(publish).toHaveBeenCalledWith("c:posts:hello", {
      collection: "posts",
      slug: "hello",
      version: "v2",
    });
  });

  it("slug 未指定時は list チャンネルのみに publish する", async () => {
    const publish = vi.fn();
    const realtime: RealtimeAdapter = { publish };
    await publishVersionUpdate(realtime, "posts", undefined, "v2");
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith("c:posts", {
      collection: "posts",
      slug: undefined,
      version: "v2",
    });
  });
});
