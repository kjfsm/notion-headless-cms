# 移行ガイド

`@notion-headless-cms/*` の破壊的変更・非推奨 API ごとの移行手順をまとめています。
新しいガイドは「削除予定バージョン」順に上から並べています。

## v2（メタパッケージ廃止・createCMS 集約）

- メタパッケージ `@notion-headless-cms/{node,cloudflare,next}` を廃止し、
  `@notion-headless-cms/client` の `createCMS`（+ `/cloudflare` `/next` `/react` サブパス）へ集約。
  設計背景は [`rfc/v2-usability-redesign.md`](../rfc/v2-usability-redesign.md) を参照。
- 旧 `createClient` + `notionSource` + preset 合成は `@notion-headless-cms/client` が
  re-export する escape hatch として引き続き利用可能。

### `createCMS()` の引数を 3 グループ（notion / render / cache）に再編

フラットだった `createCMS()` の引数を、役割ごとに `notion` / `render` / `cache` の
3 グループへまとめる破壊的変更を行った。

#### 対応表

| 旧（フラット） | 新（グループ） | 備考 |
|---|---|---|
| `schema` | `notion.schema` | |
| `token` | `notion.token` | |
| `collections` | `notion.collections` | |
| `content` | `render.content` | 省略時 `"html"` |
| `imageProxyBase` | `render.imageProxyBase` | 省略可 |
| `ogp` | `render.ogp` | 省略可（`react` モードのみ有効） |
| `runtime` | `cache`（下記参照） | フィールド廃止 |

`render` グループが空になる（`content` 既定が `"html"` で他も未指定）場合は `render` ごと省略してよい。

#### `runtime` → `cache` の展開

`runtime` フィールドは廃止し、中身に応じて `cache` グループへ展開する。

- **Cloudflare**: `runtime: cloudflarePreset({ env, ctx })` は、役割別アダプタへ明示展開する。
  ```ts
  import { createCMS, memoryCache } from "@notion-headless-cms/client";
  import { kvCache, r2Cache } from "@notion-headless-cms/client/cloudflare";

  createCMS({
    notion: { schema, token, collections },
    render: { content: "html" },
    cache: {
      // KV を document、R2 を image に割り当てる。
      // binding が optional 型のときは memoryCache() へフォールバック。
      document: env.DOC_CACHE ? kvCache({ namespace: env.DOC_CACHE }) : memoryCache(),
      image: r2Cache({ bucket: env.IMG_BUCKET }),
      waitUntil: (p) => ctx.waitUntil(p),
    },
  });
  ```
  import も `cloudflarePreset` から `kvCache` / `r2Cache` へ変更する。

- **Next.js**: `runtime: { cache: [nextCache({ tags: ["posts"] }), memoryCache()] }` は
  `cache: { document: nextCache({ tags: ["posts"] }), image: memoryCache() }` に展開する。
  import は `import { createCMS, memoryCache } from "@notion-headless-cms/client";` と
  `import { nextCache } from "@notion-headless-cms/client/next";`。

- **Node（既定）**: `runtime` を省略していた場合は `cache` も省略する
  （インメモリ LRU + 5 分 TTL の既定が適用される）。

#### 移行手順

1. `schema` / `token` / `collections` を `notion: { ... }` の中へ移す。
2. `content` / `imageProxyBase` / `ogp` を `render: { ... }` の中へ移す（空なら省略）。
3. `runtime` を上記ルールで `cache` グループへ展開し、`cloudflarePreset` の import を
   `kvCache` / `r2Cache` の import に置き換える。
4. `cache.swr.ttlMs`（既定 5 分）や `cache.waitUntil` も `cache` グループの中で指定する。

## v1.0.0 で削除予定

- [`createNotionCollection({ blocks, ogp, enrichers })` → `content: blocksFetcher({...})`](./blocks-ogp-enrichers.md)

## 他システムからの移行

- [Contentful → @notion-headless-cms (DataSourceAdapter 自作)](./contentful.md)

## 関連

- バージョン整列方針: 詳細は `docs/ja/release/1.0-checklist.md` (準備中)
- 破壊的変更の追跡: 各パッケージの `CHANGELOG.md`
