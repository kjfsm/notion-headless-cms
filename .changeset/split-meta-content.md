---
"@notion-headless-cms/core": patch
"@notion-headless-cms/cache-r2": patch
"@notion-headless-cms/cache-kv": patch
"@notion-headless-cms/cache-next": patch
---

メタデータと本文を独立キーに分離。`getItem()` を非同期遅延ロード化、`checkForUpdate` を軽量化、useSWR 連携 API を追加（破壊的変更）。

## なぜ

- `CachedItem` が `{ html, item, blocks?, markdown?, ... }` を 1 JSON に統合していたため、メタだけ欲しい場合でも HTML 込みのフルペイロードが転送される
- `checkForUpdate` が `revalidate()` で cache を破棄してから `getItem()` で **強制的に HTML を再レンダリング** していた
- クライアント側 (useSWR 等) で「メタを即時表示、本文は遅延ロード」が表現できなかった

## 主な変更

### 公開 API

新規:

- `cms.posts.getItemMeta(slug): Promise<T | null>` — メタのみ。useSWR の fetcher として直接渡せる
- `cms.posts.getItemContent(slug): Promise<ItemContentPayload | null>` — 本文 (`html` / `markdown` / `blocks` / `notionUpdatedAt`) のみ
- `CachedItemMeta<T>` / `CachedItemContent` / `ItemContentPayload` 型を export

挙動変更:

- `getItem(slug)`: メタは即座に返り、`item.content.html()` / `markdown()` / `blocks()` を呼んだ時点で初めて本文をロード（lazy）
- `checkForUpdate({ slug, since })`: cache を破棄せず、メタのみで差分判定。差分検出時は `invalidate({ kind: "content" })` + `waitUntil` でバックグラウンド再生成。戻り値は `{ changed: true; meta: T }`（旧: `{ changed: true; item: ItemWithContent<T> }`）
- `checkListForUpdate`: 個別アイテムの content cache は触らず、リストのみ更新

破壊的変更:

- `CachedItem<T>` 型を削除。代わりに `CachedItemMeta<T>` と `CachedItemContent` を使う
- `DocumentCacheAdapter` の `getItem`/`setItem` を `getItemMeta`/`setItemMeta` + `getItemContent`/`setItemContent` に分割
- `ContentResult.blocks` を `() => Promise<ContentBlock[]>` に変更（同期 getter から async メソッドへ）
- `CMSHooks.beforeCache` を `beforeCacheMeta` + `beforeCacheContent` に分割
- `InvalidateScope` に `kind?: "meta" | "content" | "all"` を追加。アダプタ実装はこの粒度を尊重する

### ストレージキー設計

| Adapter | meta key | content key | list key |
| --- | --- | --- | --- |
| R2 | `{prefix}meta/{slug}.json` | `{prefix}content/{slug}.json` | `{prefix}content.json` |
| KV | `{prefix}meta:{slug}` | `{prefix}content:{slug}` | `{prefix}content` |
| Next.js | tag `nhc:col:{c}:slug:{s}:meta` | tag `nhc:col:{c}:slug:{s}:content` | tag `nhc:col:{c}` |

R2 / KV のアダプタは `delete` / `list` を要求する `R2BucketLike` / `KVNamespaceLike` インターフェースを公開（Cloudflare Workers の R2Bucket / KVNamespace と structural に互換）。

### 移行ガイド

```diff
- const cached = await cms.posts.docCache.getItem(slug);
+ const meta = await cms.posts.docCache.getItemMeta(slug);
+ const content = await cms.posts.docCache.getItemContent(slug);

- if (result.changed) console.log(result.item);
+ if (result.changed) console.log(result.meta); // ItemWithContent ではなく T

- const blocks = post.content.blocks;
+ const blocks = await post.content.blocks();

- hooks: { beforeCache: (cached) => ({ ...cached, html: rewrite(cached.html) }) }
+ hooks: { beforeCacheContent: (content) => ({ ...content, html: rewrite(content.html) }) }
```

### useSWR レシピ

`docs/recipes/useswr-integration.md` 参照。クライアント側で `useSWR("/api/.../meta", ...)` と `useSWR("/api/.../content", ...)` を別キーで張り、`checkForUpdate` 戻り値の `meta` で `mutate` する典型パターンを記載。
