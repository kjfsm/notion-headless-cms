/**
 * M7 ベンチ: SWR list/find と memoryCache の読み書きの基本コストを計測する。
 * 回帰検知用なので、絶対値より「PR で何倍に膨らんだか」を見る。
 */
import { bench, describe } from "vitest";
import { memoryCache } from "../cache/memory";
import { createClient } from "../cms";
import type { CollectionDef, RendererFn } from "../types/config";
import type { BaseContentItem } from "../types/content";
import type { DataSource } from "../types/data-source";

const renderer: RendererFn = async (md) => `<p>${md.length}</p>`;

const items: BaseContentItem[] = Array.from({ length: 50 }, (_, i) => ({
  id: `id-${i}`,
  slug: `p-${i}`,
  title: `Post ${i}`,
  lastEditedTime: "2024-01-01T00:00:00.000Z",
}));

function makeSource(): DataSource<BaseContentItem> {
  return {
    name: "bench",
    list: async () => items,
    loadBlocks: async () => [],
    loadMarkdown: async () => "# hello",
    getLastModified: (item) => item.lastEditedTime,
    getListVersion: () => "v1",
    findByProp: async (_prop, value) =>
      items.find((i) => i.slug === value) ?? null,
    properties: { slug: { type: "title", notion: "Slug" } },
  };
}

function makeSources<C extends Record<string, CollectionDef<BaseContentItem>>>(
  cols: C,
): { bench: { readonly collections: C } } {
  return { bench: { collections: cols } };
}

describe("createClient + memoryCache", () => {
  bench("warm list() x10", async () => {
    const cms = createClient({
      renderer,
      cache: [memoryCache()],
      sources: makeSources({
        posts: { source: makeSource(), slugField: "slug" },
      }),
    });
    // 1 回目: cache miss、以後 hit
    for (let i = 0; i < 10; i++) await cms.posts.list();
  });

  bench("find by slug (cached)", async () => {
    const cms = createClient({
      renderer,
      cache: [memoryCache()],
      sources: makeSources({
        posts: { source: makeSource(), slugField: "slug" },
      }),
    });
    await cms.posts.find("p-25");
    await cms.posts.find("p-25");
  });

  bench("stats() で集計コスト", async () => {
    const cms = createClient({
      renderer,
      cache: [memoryCache()],
      sources: makeSources({
        posts: { source: makeSource(), slugField: "slug" },
      }),
    });
    await cms.posts.list();
    await cms.stats();
  });
});
