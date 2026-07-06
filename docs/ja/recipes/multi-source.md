---
title: 複数コレクション構成
description: 複数の Notion データベースを 1 つの schema にまとめる
category: レシピ
order: 7
---

# 複数コレクション構成

`@notion-headless-cms/cms` は Notion 専用設計であり、v2 にあった「Notion 以外のバックエンドと
混在させる」DataSource 抽象は無い（[`choosing-a-renderer.md`](../choosing-a-renderer.md) や
`.claude/rules/cms.md` が明示するとおり、`cms` は他パッケージへの依存を持たない独立パッケージ
として Notion アクセス・同期・配信を一括提供する）。

その代わり「複数の Notion データベースを 1 つのクライアントで型安全に扱う」パターンは
そのまま現行する。`defineSchema()` に複数の `defineCollection()` を渡すだけでよく、各コレクションは
別々の `dataSourceId`（別々の Notion DB）を指すことができる。

## スキーマ定義（2 つの Notion DB）

```ts
// app/schema.ts
import { defineCollection, defineSchema, prop } from "@notion-headless-cms/cms";

const posts = defineCollection({
  dataSourceId: "d8221462-5ae9-8396-bdac-8731f4ef685a", // ブログ記事DB
  slug: "slug",
  properties: {
    title: prop.title(),
    slug: prop.richText(),
    status: prop.status(["下書き", "公開済み"] as const),
    publishedAt: prop.date(),
  },
  statusProperty: "status",
  published: ["公開済み"],
});

const news = defineCollection({
  dataSourceId: "a1b2c3d4-5678-90ab-cdef-1234567890ab", // ニュースDB（別 Notion DB）
  slug: "slug",
  properties: {
    heading: prop.title(),
    slug: prop.richText(),
    status: prop.status(["下書き", "公開済み"] as const),
  },
  statusProperty: "status",
  published: ["公開済み"],
});

export const schema = defineSchema({ posts, news });
```

## `createCMS` での利用

追加の設定は不要。`schema` に複数コレクションを渡すだけで、各コレクションが個別の
`{ find, list }` ハンドルとして生える。

```ts
import { createCMS } from "@notion-headless-cms/cms";
import { schema } from "./schema.js";

const cms = createCMS({
  schema,
  notion: { token: process.env.NOTION_TOKEN! },
});

await cms.sync.kick();

const posts = await cms.posts.list(); // ブログ記事DB 由来
const news = await cms.news.list(); // ニュースDB 由来（別 Notion DB）
```

`cms.posts` / `cms.news` はそれぞれ `defineCollection` の `properties` から型推論された
`InferEntry<C>` を持つ（`cms.posts.find()` は `Post` 形、`cms.news.find()` は `News` 形）。

## URL を持たない設定値コレクション

`slug` を省略すると、そのコレクションは Notion の page id でアドレスされる。ブログ記事のような
URL を持つコンテンツとは別に、サイト全体の設定値・選択肢一覧を同じ `schema` に混在させられる。

```ts
const siteTexts = defineCollection({
  dataSourceId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  // slug を省略 → find(pageId) でアドレスする
  properties: {
    key: prop.richText(),
    value: prop.richText(),
  },
});

export const schema = defineSchema({ posts, news, siteTexts });
```

## 内部実装: 単一の同期コーディネータに合成される

複数コレクションは `createCMS` 内部で `createMultiSourceDeps()`（`sync/multi-source.ts`）により
1 つの `SyncCoordinatorCore` に合成される。ユーザーが明示的に配線する概念ではないが、動作を
理解しておくと役立つ点が 2 つある。

- **レートリミッタ・chunk 処理はコレクション横断で共有される**。`sync.chunkSize`（既定 2）は
  「1 サイクルで処理する entry 数」を全コレクション合計で数える。コレクションが増えるほど
  1 コレクションあたりの同期頻度は相対的に下がる。
- **コレクション名に `":"` を含められない**。合成カーソルが `"{collection}:{slug}"` で
  名前空間化するため、`":"` を含む名前は `schema/reserved_collection_name` エラーになる。

## 関連ドキュメント

- [Cloudflare Workers + R2 + D1](./cloudflare-workers.md)
- [Node.js スクリプト](./nodejs-script.md)
- [CMS メソッド一覧](../api/cms-methods.md)
