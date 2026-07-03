import { describe, expect, it, vi } from "vitest";
import type { EntrySnapshot } from "../../types/entry-snapshot.js";
import { createPreviewHandler } from "../handler.js";
import { createPreviewUrl } from "../signature.js";

const SECRET = "s3cr3t";

function snapshot(): EntrySnapshot {
  return {
    collection: "posts",
    slug: "hello",
    version: "v1",
    meta: {},
    blocks: [],
    images: {},
    links: {},
  };
}

describe("createPreviewHandler", () => {
  it("有効な署名なら readThrough の結果を返す(no-store)", async () => {
    const now = 1_000_000;
    const readThrough = vi.fn().mockResolvedValue(snapshot());
    const handler = createPreviewHandler({
      secret: SECRET,
      readThrough,
      now: () => now,
    });

    const url = await createPreviewUrl(
      "https://x/api/cms/preview/posts/hello",
      {
        secret: SECRET,
        collection: "posts",
        slug: "hello",
        now,
      },
    );
    const res = await handler(new Request(url), "posts/hello");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual(snapshot());
    expect(readThrough).toHaveBeenCalledWith("posts", "hello");
  });

  it("sig/exp が無ければ 404", async () => {
    const readThrough = vi.fn();
    const handler = createPreviewHandler({ secret: SECRET, readThrough });
    const res = await handler(
      new Request("https://x/api/cms/preview/posts/hello"),
      "posts/hello",
    );
    expect(res.status).toBe(404);
    expect(readThrough).not.toHaveBeenCalled();
  });

  it("署名が不正なら 404(readThrough は呼ばれない)", async () => {
    const readThrough = vi.fn();
    const handler = createPreviewHandler({ secret: SECRET, readThrough });
    const res = await handler(
      new Request(
        "https://x/api/cms/preview/posts/hello?sig=bogus&exp=9999999999999",
      ),
      "posts/hello",
    );
    expect(res.status).toBe(404);
    expect(readThrough).not.toHaveBeenCalled();
  });

  it("readThrough が null を返せば(存在しない下書き)404", async () => {
    const now = 1_000_000;
    const readThrough = vi.fn().mockResolvedValue(null);
    const handler = createPreviewHandler({
      secret: SECRET,
      readThrough,
      now: () => now,
    });
    const url = await createPreviewUrl(
      "https://x/api/cms/preview/posts/missing",
      {
        secret: SECRET,
        collection: "posts",
        slug: "missing",
        now,
      },
    );
    const res = await handler(new Request(url), "posts/missing");
    expect(res.status).toBe(404);
  });

  it("プレビュー経路はキャッシュ層に一切触れない(readThrough 以外の副作用が無い)", async () => {
    const now = 1_000_000;
    const readThrough = vi.fn().mockResolvedValue(snapshot());
    const handler = createPreviewHandler({
      secret: SECRET,
      readThrough,
      now: () => now,
    });
    const url = await createPreviewUrl(
      "https://x/api/cms/preview/posts/hello",
      {
        secret: SECRET,
        collection: "posts",
        slug: "hello",
        now,
      },
    );
    await handler(new Request(url), "posts/hello");
    // readThrough 経由のみでデータを取得しており、他の I/O 手段(store 等)は
    // 一切依存関係として渡していない(型シグネチャ上、渡しようがない設計)。
    expect(readThrough).toHaveBeenCalledTimes(1);
  });
});
