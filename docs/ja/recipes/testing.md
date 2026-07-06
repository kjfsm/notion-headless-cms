---
title: テスト
description: Notion API を叩かずに @notion-headless-cms/cms を検証する
category: レシピ
order: 7
---

# テストレシピ

`@notion-headless-cms/cms` は Notion 用の DataSource 抽象を持たない（Notion 専用設計）ため、
v2 にあった `@notion-headless-cms/testing` の `createFixtureClient()` / `fakeRenderer` のような
「CMS 全体を丸ごと差し替えるフィクスチャ」は存在しない。代わりに 2 つの現実的なテスト戦略がある。

1. **`notion.client` にフェイクの Notion クライアントを渡し、in-memory ストアで `createCMS` を丸ごと動かす**（統合テスト向け）
2. **自作の `IndexStore`/`BlobStore` 実装を `./testing` サブパスの契約テストで検証する**（カスタムストレージ向け、[`custom-cache.md`](./custom-cache.md) 参照）

## 1. フェイク Notion クライアント + in-memory ストアで `createCMS` を検証する

`notion.client` は `NotionClientLike`（`dataSources.query` / `pages.retrieve` /
`blocks.children.list` の 3 メソッドだけを要求する構造型）を受け取る。`@notionhq/client` の
`Client` を new せず、テスト用のフェイクをそのまま渡せる。

```ts
import type { PageObjectResponse } from "@notionhq/client";
import { describe, expect, it, vi } from "vitest";
import {
  createCMS,
  createNodeSyncScheduler,
  defineCollection,
  defineSchema,
  memoryBlobStore,
  memoryIndexStore,
  prop,
} from "@notion-headless-cms/cms";
import type { NotionClientLike } from "@notion-headless-cms/cms";

const posts = defineCollection({
  dataSourceId: "ds-posts",
  slug: "slug",
  properties: {
    title: prop.title(),
    slug: prop.richText(),
    status: prop.status(["draft", "published"] as const),
  },
  statusProperty: "status",
  published: ["published"],
});

const schema = defineSchema({ posts });

function richText(text: string) {
  return [{ type: "text", plain_text: text, text: { content: text } }];
}

function notionPage(opts: {
  id: string;
  slug: string;
  title: string;
  status: string;
}): PageObjectResponse {
  return {
    object: "page",
    id: opts.id,
    url: `https://notion.so/${opts.id}`,
    last_edited_time: "2026-01-01T00:00:00.000Z",
    properties: {
      title: { type: "title", title: richText(opts.title) },
      slug: { type: "rich_text", rich_text: richText(opts.slug) },
      status: { type: "status", status: { name: opts.status } },
    },
  } as unknown as PageObjectResponse;
}

function makeFakeClient(pages: PageObjectResponse[]): NotionClientLike {
  return {
    dataSources: {
      query: vi.fn(async () => ({
        results: pages,
        next_cursor: null,
        has_more: false,
      })),
    },
    pages: { retrieve: vi.fn().mockRejectedValue(new Error("not found")) },
    blocks: {
      children: {
        list: vi.fn().mockResolvedValue({ results: [], next_cursor: null, has_more: false }),
      },
    },
  };
}

describe("posts", () => {
  it("list / find が公開済みアイテムを返す", async () => {
    const cms = createCMS({
      schema,
      notion: {
        client: makeFakeClient([
          notionPage({ id: "1", slug: "hello", title: "Hi", status: "published" }),
          notionPage({ id: "2", slug: "draft", title: "Draft", status: "draft" }),
        ]),
      },
      stores: { index: memoryIndexStore(), blobs: memoryBlobStore() },
      scheduler: createNodeSyncScheduler(),
    });

    // kick() は 1 チャンク（既定 2 件）だけ処理する設計なので、cursor が尽きるまで回す。
    let state = await cms.sync.getState();
    do {
      await cms.sync.kick();
      state = await cms.sync.getState();
    } while (state.cursor !== null);

    const { items } = await cms.posts.list();
    expect(items.map((item) => item.slug)).toEqual(["hello"]);

    const found = await cms.posts.find("hello");
    expect(found?.meta.title).toBe("Hi");
  });
});
```

`stores` を省略すると in-memory（`memoryIndexStore()`/`memoryBlobStore()`）にフォールバックするため、
明示しなくても同じ結果になる。ただし複数テストで状態を共有したくない場合はテストごとに
`createCMS()` を呼び直す（in-memory ストアはインスタンスごとに独立している）。

## 2. HTTP ハンドラのテスト（`cms.fetch()`）

`cms.fetch(request)` は Web 標準の `Request`/`Response` を受け取るだけなので、実サーバーを
立てずに直接呼べる。

```ts
import { describe, expect, it } from "vitest";
import { cms } from "../lib/cms.js";

describe("画像プロキシ", () => {
  it("存在しないハッシュは 404", async () => {
    const res = await cms.fetch(new Request("http://localhost/api/cms/images/does-not-exist"));
    expect(res.status).toBe(404);
  });
});
```

Webhook のテストは `X-Notion-Signature` の HMAC-SHA256 署名を自前で計算して付与するか、
`verification_token` を含む素の JSON ボディ（署名不要）でハンドシェイクだけを検証する。

## 3. 自作 `IndexStore`/`BlobStore` を契約テストで検証する

Redis / S3 など独自ストレージに差し替えた場合は、`@notion-headless-cms/cms/testing`
（`vitest` 依存の専用エントリ。汎用 `.` エントリからは import しない設計）の
`runIndexStoreContract()` / `runBlobStoreContract()` に自分の実装ファクトリを渡すだけで、
memory/file/D1/SQLite/libSQL/Cloudflare 実装と同じ挙動を保証できる。

```ts
import { describe } from "vitest";
import { runIndexStoreContract } from "@notion-headless-cms/cms/testing";
import { redisIndexStore } from "../redis-index-store.js";

describe("redisIndexStore", () => {
  runIndexStoreContract({
    factory: () => redisIndexStore(testRedisClient),
  });
});
```

詳細な実装例は [`custom-cache.md`](./custom-cache.md) を参照。`@notion-headless-cms/sql` の
`sqliteIndexStore`/`libsqlIndexStore`（`:memory:`）に対しても同じ契約テストが走っている
（`packages/sql/src/__tests__/contract.test.ts`）。

## CI で何をモックして何をモックしないか

| レイヤ                       | テスト戦略                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| Notion API (`notion.client`) | **必ずフェイク**。実 token を使うテストは CI でスキップする                         |
| `IndexStore`/`BlobStore`     | 独自実装は契約テスト（上記 3）、それ以外は `memoryIndexStore()`/`memoryBlobStore()` |
| `cms.fetch()` のルーティング | `Request`/`Response` を直接組み立てて assertion する                                |

実 Notion API を叩く E2E テストが必要な場合は `examples/*` ディレクトリを参照し、CI 上では
`NOTION_TOKEN` が無い環境を前提に skip する（`examples/*/e2e/*.spec.ts` が Playwright での実例）。
