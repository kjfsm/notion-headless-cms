---
title: テスト (fake source / fake cache)
description: @notion-headless-cms/testing で Notion API を叩かずに CMSClient を検証する
category: レシピ
order: 7
---

# テスト用ユーティリティ (`@notion-headless-cms/testing`)

Notion API / 永続キャッシュ / 実 renderer を一切起動せずに `createClient` と同じ public API で
ユニットテストを書くためのヘルパー集。

## インストール

```bash
pnpm add -D @notion-headless-cms/testing
```

devDependency にのみ入れる。ランタイム依存は `@notion-headless-cms/core` のみで、`notion-orm` / `@notionhq/client` / `markdown-html` を要求しない。

## 提供する API

| 関数 | 役割 |
|---|---|
| `createFakeNotionSource({ items })` | 任意の items 配列から `CMSAdapter` を組み立てる |
| `createFakeCache()` | doc + image 両方を担当する in-memory `CacheAdapter` (内部状態を `dump()` で覗ける) |
| `createFixtureClient({ items })` | 上記 2 つを内部で組み合わせた `createClient` ラッパ |
| `fakeRenderer` | `(markdown) => `<article>${markdown}</article>`` を返す最小 renderer |

## 最小例 — list と find

```ts
import { describe, expect, it } from "vitest";
import { createFixtureClient } from "@notion-headless-cms/testing";

describe("posts", () => {
  it("list / find が公開済みアイテムを返す", async () => {
    const cms = createFixtureClient({
      items: [
        { id: "1", slug: "hello", title: "Hi", lastEditedTime: "2024-01-01", status: "公開済み" },
        { id: "2", slug: "draft", title: "Draft", lastEditedTime: "2024-01-02", status: "下書き" },
      ],
      collections: {
        posts: {
          items: /* ↑ items を再指定するときは collections を使う */ [],
          publishedStatuses: ["公開済み"],
        },
      },
    });
    const list = await cms.posts.list();
    expect(list.map((it) => it.slug)).toEqual(["hello"]);
  });
});
```

> `items` と `collections` は択一。`items` のみ指定すると `posts` という単一コレクションになる。

## 複数コレクション

```ts
import { createFixtureClient } from "@notion-headless-cms/testing";

const cms = createFixtureClient({
  collections: {
    posts: { items: postItems, publishedStatuses: ["公開済み"] },
    news: { items: newsItems, publishedStatuses: ["published"] },
  },
});
```

## 自前で source / cache / renderer を組み合わせる

`createClient` を直接呼んで個別の helper を組み合わせることもできる。
キャッシュ書き込みの中身を assertion したいときに便利。

```ts
import { createClient } from "@notion-headless-cms/core";
import {
  createFakeNotionSource,
  createFakeCache,
  fakeRenderer,
} from "@notion-headless-cms/testing";

const cache = createFakeCache();

const cms = createClient({
  sources: { notion: createFakeNotionSource({ items: samplePosts }) },
  cache: [cache],
  renderer: fakeRenderer,
});

await cms.posts.list();

// cache 内のキー数を検証
const dump = cache.dump();
expect(dump.lists.size).toBe(1);
expect(dump.metas.size).toBe(samplePosts.length);
```

## SWR の TTL 切れ挙動を検証する

`vi.useFakeTimers()` と組み合わせれば、TTL 切れ後のブロッキング再取得を観察できる。

```ts
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createFixtureClient, createFakeNotionSource } from "@notion-headless-cms/testing";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("staleBlockMs 超過で再取得が走る", async () => {
  let version = 1;
  const items = () => [
    { id: "1", slug: "x", title: `v${version}`, lastEditedTime: `2024-01-0${version}` },
  ];
  const adapter = createFakeNotionSource({ items: items() });
  // 元の adapter.collections.posts.source.list を差し替えて呼び出し回数を数える
  const listSpy = vi.spyOn(adapter.collections.posts!.source, "list");

  const cms = createFixtureClient({
    sources: { notion: adapter },
    // recheckWindowMs: 0 で coalescing を無効化し、staleBlockMs で挙動を検証
    swr: { recheckWindowMs: 0, staleBlockMs: 1_000 },
  });

  await cms.posts.list();
  expect(listSpy).toHaveBeenCalledTimes(1);

  // staleBlockMs 以内 → 即キャッシュ表示
  vi.advanceTimersByTime(500);
  await cms.posts.list();
  expect(listSpy).toHaveBeenCalledTimes(1);

  // staleBlockMs 超過 → ブロッキング再取得
  vi.advanceTimersByTime(1_500);
  await cms.posts.list();
  expect(listSpy).toHaveBeenCalledTimes(2);
});
```

詳細は [`api/cms-methods.md#swr-stale-while-revalidate-のキャッシュ挙動`](../api/cms-methods.md#swr-stale-while-revalidate-のキャッシュ挙動) を参照。

## CI で何をモックして何をモックしないか

| レイヤ | テスト戦略 |
|---|---|
| `DataSource` (= Notion API) | **必ず fake**。実 token を使うテストは CI でスキップする |
| `CacheAdapter` | `createFakeCache()` で in-memory に置く |
| `RendererFn` | `fakeRenderer` (markdown-html を import しなくて済む) |
| `cms.handler()` のルーティング | `Request` / `Response` を直接組み立てて assertion する |

実 Notion API を叩く E2E テストが必要な場合は、`examples/*` ディレクトリで `nhc generate` 後に動作確認するか、CI 上では token が無い環境を前提に skip する。
