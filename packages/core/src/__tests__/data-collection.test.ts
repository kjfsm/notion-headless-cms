import { describe, expect, it, vi } from "vitest";
import { memoryCache } from "../cache/memory";
import { createClient } from "../cms";
import type { RendererFn } from "../types/config";
import type { BaseContentItem } from "../types/content";
import type { DataSource } from "../types/data-source";

const mockRenderer: RendererFn = vi.fn().mockResolvedValue("<p>test</p>");

function makeMockSource(
  overrides: Partial<DataSource<BaseContentItem>> = {},
): DataSource<BaseContentItem> {
  return {
    name: "mock",
    async list() {
      return [];
    },
    async loadBlocks() {
      return [];
    },
    loadMarkdown: vi.fn().mockResolvedValue(""),
    getLastModified(item) {
      return item.lastEditedTime;
    },
    getListVersion(items) {
      return items.map((i) => i.lastEditedTime).join(",");
    },
    ...overrides,
  };
}

/** slug を持たない要素アイテム（設定値一覧のイメージ）。 */
function makeDataItems(): BaseContentItem[] {
  return [
    { id: "page-a", lastEditedTime: "2024-01-01T00:00:00Z", title: "設定A" },
    { id: "page-b", lastEditedTime: "2024-01-02T00:00:00Z", title: "設定B" },
  ];
}

function makeDataCms(
  listImpl: () => Promise<BaseContentItem[]>,
  dbName?: string,
) {
  return createClient({
    renderer: mockRenderer,
    cache: [memoryCache()],
    sources: {
      mock: {
        collections: {
          settings: {
            kind: "data",
            source: makeMockSource({ list: listImpl }),
            ...(dbName ? { dbName } : {}),
          },
        },
      },
    },
  });
}

describe("要素（データ）コレクション", () => {
  it("slug を持たないアイテムでも list() で全件取得できる", async () => {
    const cms = makeDataCms(async () => makeDataItems());
    const items = await (
      cms as unknown as {
        settings: { list(): Promise<BaseContentItem[]> };
      }
    ).settings.list();
    expect(items).toHaveLength(2);
    expect([...items.map((i) => i.id)].sort()).toEqual(["page-a", "page-b"]);
    expect(items[0]?.slug).toBeUndefined();
  });

  it("dbName を指定すると cms.<collection>.dbName で参照できる", async () => {
    const cms = makeDataCms(async () => makeDataItems(), "設定DB");
    const settings = (cms as unknown as { settings: { dbName?: string } })
      .settings;
    expect(settings.dbName).toBe("設定DB");
  });

  it("dbName 未指定なら undefined", async () => {
    const cms = makeDataCms(async () => makeDataItems());
    const settings = (cms as unknown as { settings: { dbName?: string } })
      .settings;
    expect(settings.dbName).toBeUndefined();
  });

  it("get(id) で id をキーに 1 件取得できる", async () => {
    const cms = makeDataCms(async () => makeDataItems());
    const settings = (
      cms as unknown as {
        settings: { get(id: string): Promise<BaseContentItem | null> };
      }
    ).settings;
    const got = await settings.get("page-b");
    expect(got?.id).toBe("page-b");
    expect(got?.title).toBe("設定B");
    const missing = await settings.get("does-not-exist");
    expect(missing).toBeNull();
  });

  it("cache.invalidate() でリストキャッシュが作り直される", async () => {
    // lastEditedTime を固定し getListVersion を不変にすることで SWR の
    // バックグラウンド再検証では更新されず、invalidate の効果だけを検証する。
    let title = "v1";
    const list = vi.fn(
      async (): Promise<BaseContentItem[]> => [
        { id: "page-a", lastEditedTime: "2024-01-01T00:00:00Z", title },
      ],
    );
    const cms = makeDataCms(list);
    const settings = (
      cms as unknown as {
        settings: {
          list(): Promise<BaseContentItem[]>;
          cache: { invalidate(): Promise<void> };
        };
      }
    ).settings;

    const first = await settings.list();
    expect(first[0]?.title).toBe("v1");
    // version 不変なのでキャッシュヒットで stale を返す。
    title = "v2";
    const cached = await settings.list();
    expect(cached[0]?.title).toBe("v1");
    // 無効化後は再取得される。
    await settings.cache.invalidate();
    const fresh = await settings.list();
    expect(fresh[0]?.title).toBe("v2");
  });

  it("複数の slug 無しアイテムが id でキー分離され衝突しない", async () => {
    const cms = makeDataCms(async () => makeDataItems());
    const settings = (
      cms as unknown as {
        settings: { get(id: string): Promise<BaseContentItem | null> };
      }
    ).settings;
    const a = await settings.get("page-a");
    const b = await settings.get("page-b");
    expect(a?.title).toBe("設定A");
    expect(b?.title).toBe("設定B");
  });

  it("warmByPageId は要素コレクションでは slug を付けず collection のみ返す", async () => {
    const cms = makeDataCms(async () => makeDataItems());
    const result = await (
      cms as unknown as {
        warmByPageId(
          id: string,
        ): Promise<{ collection: string; slug?: string } | null>;
      }
    ).warmByPageId("page-a");
    expect(result).toEqual({ collection: "settings" });
    // id を slug 欄に偽装しない。
    expect(result && "slug" in result).toBe(false);
  });

  it("要素コレクションへの versions リクエストは version_unsupported (400) を返す", async () => {
    const cms = makeDataCms(async () => makeDataItems());
    const handler = (
      cms as unknown as { handler(): (req: Request) => Promise<Response> }
    ).handler();
    const res = await handler(
      new Request("http://localhost/api/cms/versions/settings/anything"),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("handler/version_unsupported");
  });

  it("未知コレクションへの versions リクエストは unknown_collection (404) を返す", async () => {
    const cms = makeDataCms(async () => makeDataItems());
    const handler = (
      cms as unknown as { handler(): (req: Request) => Promise<Response> }
    ).handler();
    const res = await handler(
      new Request("http://localhost/api/cms/versions/nope/anything"),
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("handler/unknown_collection");
  });
});
