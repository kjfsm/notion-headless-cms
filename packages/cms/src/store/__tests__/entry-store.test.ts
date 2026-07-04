import { describe, expect, it } from "vitest";
import type { EntrySnapshot } from "../../types/entry-snapshot.js";
import { createEntryStore } from "../entry-store.js";
import { memoryBlobStore } from "../memory.js";

function makeSnapshot(
  overrides: Partial<EntrySnapshot> = {},
): EntrySnapshot<{ title: string }> {
  return {
    collection: "posts",
    slug: "hello",
    version: "2026-01-01T00:00:00.000Z",
    meta: { title: "Hello" },
    blocks: [],
    images: {},
    links: {},
    ...overrides,
  } as EntrySnapshot<{ title: string }>;
}

describe("createEntryStore", () => {
  it("put した snapshot を get で読み戻せる", async () => {
    const store = createEntryStore(memoryBlobStore());
    const snapshot = makeSnapshot();
    await store.put(snapshot);
    const got = await store.get<{ title: string }>("posts", "hello");
    expect(got).toEqual(snapshot);
  });

  it("存在しない entry は null を返す", async () => {
    const store = createEntryStore(memoryBlobStore());
    expect(await store.get("posts", "missing")).toBeNull();
  });

  it("put は既存版をアトミックに上書きする(旧版は残らない)", async () => {
    const blobs = memoryBlobStore();
    const store = createEntryStore(blobs);
    await store.put(
      makeSnapshot({
        version: "v1",
        meta: { title: "old" },
      } as Partial<EntrySnapshot>),
    );
    await store.put(
      makeSnapshot({
        version: "v2",
        meta: { title: "new" },
      } as Partial<EntrySnapshot>),
    );
    const got = await store.get<{ title: string }>("posts", "hello");
    expect(got?.version).toBe("v2");
    expect(got?.meta.title).toBe("new");
  });

  it("delete 後は get が null を返す", async () => {
    const store = createEntryStore(memoryBlobStore());
    await store.put(makeSnapshot());
    await store.delete("posts", "hello");
    expect(await store.get("posts", "hello")).toBeNull();
  });

  it("異なる collection/slug は別キーで保存される", async () => {
    const store = createEntryStore(memoryBlobStore());
    await store.put(makeSnapshot({ slug: "a" }));
    await store.put(makeSnapshot({ slug: "b" }));
    expect((await store.get("posts", "a"))?.slug).toBe("a");
    expect((await store.get("posts", "b"))?.slug).toBe("b");
  });
});
