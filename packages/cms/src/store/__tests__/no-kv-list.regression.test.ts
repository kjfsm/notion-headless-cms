import type { PageObjectResponse } from "@notionhq/client";
import { describe, expect, it, vi } from "vitest";
import { createCMS } from "../../cms/create-cms.js";
import { createNodeSyncScheduler } from "../../sync/node-scheduler.js";
import type { NotionClientLike } from "../../sync/notion-driver.js";
import { defineCollection, defineSchema } from "../../types/collection.js";
import { prop } from "../../types/property.js";
import { kvDocStore, r2BlobStore } from "../cloudflare.js";
import type { KVNamespaceLike } from "../cloudflare-types.js";

/**
 * `.list()` を呼んだら即座に落ちる fake KV namespace。KV の list() 操作クォータ
 * (無料枠 1,000 回/日)を読者リクエストの延長で消費してしまう退行を防ぐための
 * 最終防御線(#437 障害の原因そのもの)。`DocStore` から `.list()` を削除したため
 * 通常は型エラーで弾かれるが、`KVNamespaceLike` を直接握るコードが将来追加された
 * 場合に備えて実行時にも検証する。
 */
function makeNoListKvNamespace(): KVNamespaceLike {
  const store = new Map<string, string>();
  return {
    async get(key) {
      return store.get(key) ?? null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
    list(): never {
      throw new Error("KV list() は呼んではならない");
    },
  };
}

function richText(text: string) {
  return [{ type: "text", plain_text: text, text: { content: text } }];
}

function notionPage(opts: { id: string; slug: string }): PageObjectResponse {
  return {
    object: "page" as const,
    id: opts.id,
    url: `https://notion.so/${opts.id}`,
    last_edited_time: "2026-01-01T00:00:00.000Z",
    properties: {
      title: { type: "title", title: richText("Title") },
      slug: { type: "rich_text", rich_text: richText(opts.slug) },
    },
  } as unknown as PageObjectResponse;
}

function makeFakeClient(pages: PageObjectResponse[]): NotionClientLike {
  return {
    dataSources: {
      query: vi.fn().mockResolvedValue({
        results: pages,
        next_cursor: null,
        has_more: false,
      }),
    },
    pages: { retrieve: vi.fn().mockRejectedValue(new Error("not found")) },
    blocks: {
      children: {
        list: vi.fn().mockResolvedValue({
          results: [],
          next_cursor: null,
          has_more: false,
        }),
      },
    },
  };
}

describe("KV list() 回帰テスト", () => {
  const posts = defineCollection({
    dataSourceId: "ds-posts",
    slug: "slug",
    properties: { title: prop.title(), slug: prop.richText() },
  });
  const schema = defineSchema({ posts });

  it("find/list/sync.kick/sync.reconcile は KV の list() を一度も呼ばない", async () => {
    const kv = makeNoListKvNamespace();
    const client = makeFakeClient([notionPage({ id: "p1", slug: "hello" })]);
    const scheduler = createNodeSyncScheduler();

    const cms = createCMS({
      schema,
      notion: { client },
      scheduler,
      stores: { docs: kvDocStore(kv), blobs: r2BlobStore(makeFakeR2Bucket()) },
    });

    await expect(cms.sync.kick()).resolves.not.toThrow();
    await expect(cms.posts.find("hello")).resolves.not.toBeNull();
    await expect(cms.posts.list()).resolves.toMatchObject({
      items: [expect.objectContaining({ slug: "hello" })],
    });
    await expect(cms.sync.reconcile()).resolves.not.toThrow();
  });
});

function makeFakeR2Bucket() {
  const store = new Map<string, { bytes: Uint8Array; contentType?: string }>();
  return {
    async get(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      return {
        arrayBuffer: async () => new Uint8Array(entry.bytes).buffer,
        httpMetadata: { contentType: entry.contentType },
      };
    },
    async put(
      key: string,
      value: ArrayBuffer | Uint8Array,
      opts?: { httpMetadata?: { contentType?: string } },
    ) {
      const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
      store.set(key, { bytes, contentType: opts?.httpMetadata?.contentType });
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}
