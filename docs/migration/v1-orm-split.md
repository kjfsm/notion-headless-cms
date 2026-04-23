# v1 ORM 分離 + コレクション API 移行ガイド

限定公開期間中の破壊的変更。`createCMS` の入力形式と、CMS クライアントの API を全面刷新した。`nhc generate` を再実行すれば移行の大半は完了する。

## 主な変更点

### 1. `createCMS()` の引数: `source` → `dataSources`

**旧**
```ts
import { createCMS } from "@notion-headless-cms/core";
import { notionAdapter } from "@notion-headless-cms/source-notion";

const cms = createCMS({
  source: notionAdapter({ token, dataSourceId, schema }),
  renderer: renderMarkdown,
  cache: { ... },
});

await cms.list();
await cms.find(slug);
await cms.cache.get(slug);
```

**新**
```ts
import { createCMS } from "@notion-headless-cms/core";
import { nhcDataSources } from "./generated/nhc-schema";

const cms = createCMS({
  dataSources: nhcDataSources,     // ← CLI 生成物をそのまま渡す
  renderer: renderMarkdown,
  cache: { ... },
});

await cms.posts.getList();               // ← コレクション別
await cms.posts.getItem(slug);           // ← 本文込み (blocks + 遅延 html)
```

### 2. `@notion-headless-cms/source-notion` → `@notion-headless-cms/notion-orm`

パッケージ名を変更し、**`private: true`** にした。ユーザーは直接 import しない。  
`nhc generate` が生成する `nhc-schema.ts` が `createNotionCollection()` を使って
`nhcDataSources` を組み立てるので、ユーザーコードは Notion を意識する必要がない。

`package.json` の `dependencies` を置き換える:
```diff
- "@notion-headless-cms/source-notion": "workspace:*"
+ "@notion-headless-cms/notion-orm": "workspace:*"
```

### 3. CMS メソッド名の変更

| 旧 | 新 |
|---|---|
| `cms.list()` | `cms.posts.getList()` |
| `cms.find(slug)` | `cms.posts.getItem(slug)` (本文込み) |
| `cms.findMany(slugs)` | なし (必要なら `Promise.all(slugs.map(s => cms.posts.getItem(s)))`) |
| `cms.getStaticSlugs()` | `cms.posts.getStaticParams()` (Next 向け) / `cms.posts.getStaticPaths()` (string[]) |
| `cms.cache.get(slug)` | `cms.posts.getItem(slug)` (SWR 自動適用) |
| `cms.cache.getList()` | `cms.posts.getList()` (SWR 自動適用) |
| `cms.cache.prefetchAll()` | `cms.posts.prefetch()` |
| `cms.cache.revalidate()` | `cms.$revalidate()` / `cms.posts.revalidate()` |
| `cms.query().status().tag()` | `cms.posts.getList({ statuses, tag, sort, limit, skip })` |
| `cms.getCachedImage(hash)` | `cms.$getCachedImage(hash)` |
| `cms.createCachedImageResponse(hash)` | `cms.$handler()` 内で処理 |

### 4. 本文は blocks AST 第一級

`getItem()` の返り値は `T & { content: ContentResult }` で、`content` は以下の構造:

```ts
type ContentResult = {
  blocks: ContentBlock[];     // 常に同梱 (第一級)
  html(): Promise<string>;    // 遅延
  markdown(): Promise<string>; // 遅延
};
```

**旧**
```ts
const entry = await cms.cache.get(slug);
// entry.html は即時取得
<div dangerouslySetInnerHTML={{ __html: entry.html }} />
```

**新**
```ts
const post = await cms.posts.getItem(slug);
const html = await post.content.html();         // 遅延呼び出し
<div dangerouslySetInnerHTML={{ __html: html }} />

// または blocks を直接マッピング:
for (const block of post.content.blocks) {
  if (block.type === "heading") { ... }
  if (block.type === "paragraph") { ... }
  if (block.type === "image") { ... }
}
```

### 5. adapter-node / adapter-cloudflare の引数変更

| 旧 | 新 |
|---|---|
| `createNodeCMS({ schema: nhcSchema, sources })` | `createNodeCMS({ dataSources: nhcDataSources })` |
| `createCloudflareCMS({ schema: nhcSchema, env, sources })` | `createCloudflareCMS({ dataSources: nhcDataSources, env })` |
| `client.posts` (コレクションは `.posts` でアクセス) | 変わらず `cms.posts` |

公開ステータスは `nhc.config.ts` の `fields.status` + スキーマ生成段階で暗黙に扱う。
`sources: { posts: { published: [...] } }` オプションは削除。

### 6. `cms.$handler()` — Web Standard Route Handler

Next / Hono / Cloudflare Workers 等で共通利用できる:

```ts
const handler = cms.$handler({ basePath: "/api/cms" });
// GET /api/cms/images/:hash   → 画像プロキシ
// POST /api/cms/revalidate    → Webhook 受信
```

`createImageRouteHandler` / `createRevalidateRouteHandler` (adapter-next) は
引き続き使えるが、新規は `$handler()` を推奨。

## 移行手順

1. `package.json` の `@notion-headless-cms/source-notion` を `@notion-headless-cms/notion-orm` に置換
2. `pnpm install`
3. `nhc generate` を再実行 → 生成物が `nhcDataSources` 形式に更新される
4. `lib/cms.ts` で `schema: nhcSchema` を `dataSources: nhcDataSources` に
5. 各ルート・ローダーで `cms.cache.get()` → `cms.posts.getItem()` 等に書き換え
6. `entry.html` は `await post.content.html()` に

## バージョン

限定公開期間中のため **patch bump**。メジャーバンプは正式公開時に実施する。
