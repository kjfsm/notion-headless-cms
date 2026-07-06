---
title: Node.js スクリプト
description: シンプルな Node スクリプトから使う
category: レシピ
order: 2
---

# Node スクリプトでの利用

バッチ処理や CI 内の一覧出力など、Node.js スクリプトから Notion を取得する場合。
完全な例は [`examples/minimal-node/`](../../../examples/minimal-node/)（1 ファイル・30 行以内）
にある。

## インストール

```bash
pnpm add @notion-headless-cms/cms @notionhq/client
```

## スキーマ定義

```ts
// src/schema.ts
import { defineCollection, defineSchema, prop } from "@notion-headless-cms/cms";

const posts = defineCollection({
  dataSourceId: "34a21462-5ae9-80a7-a17b-000b93010c9f",
  slug: "slug",
  properties: {
    title: prop.title("名前"),
    slug: prop.richText("URL"),
    status: prop.status(["下書き", "編集中", "公開済み"] as const, "ステータス"),
    publishedAt: prop.date("公開日"),
    author: prop.select(undefined, "著者"),
  },
  statusProperty: "status",
  published: ["公開済み"],
  accessible: ["下書き", "編集中", "公開済み"],
});

export const schema = defineSchema({ posts });
```

`nhc pull` は Notion DB を introspect してこの雛形を**一度だけ**生成する補助コマンド。以降は
このファイルを直接編集して育てる運用（codegen ではない）。

## スクリプト例

```ts
// src/index.ts
import { createCMS } from "@notion-headless-cms/cms";
import { schema } from "./schema.js";

// stores/scheduler を省略すると in-memory ストア + Node スケジューラにフォールバックする
// （D1/R2/DO バインディング無しで動く最小構成）。
const cms = createCMS({
  schema,
  notion: { token: process.env.NOTION_TOKEN ?? "" },
});

// kick() は 1 チャンク（既定 2 件）だけ処理する設計（Workers の chunked sync 用）。
// 一括スクリプトとして全件を確実に読者に反映するため、cursor が尽きるまで手動で回す。
let state = await cms.sync.getState();
do {
  await cms.sync.kick();
  state = await cms.sync.getState();
} while (state.cursor !== null);

const { items: posts } = await cms.posts.list();
console.log(`${posts.length} 件の記事を取得しました`);
for (const post of posts) {
  const meta = post.meta as { title?: string };
  console.log(`- ${post.slug}\t${meta.title ?? "(no title)"}`);
}
```

```bash
NOTION_TOKEN=ntn_xxxxx node --env-file=.env src/index.ts
```

## 本文を HTML で取り出す

React を使わない場面（RSS フィード、メール本文など）では `./html` サブパスの
`renderBlocksToHtml()` で本文を HTML 文字列に変換できる。

```ts
import { renderBlocksToHtml } from "@notion-headless-cms/cms/html";

const post = await cms.posts.find("my-post-slug");
if (post) {
  const html = renderBlocksToHtml(post.blocks, { links: post.links });
  console.log(html);
}
```

## 複数回の実行間でキャッシュを永続化する（ファイルストア）

デフォルトの in-memory ストアはプロセス終了とともに消える。CI ローカルキャッシュや
オフライン開発など、実行のたびに全件再取得したくない場合は `./node` サブパスの
`fileIndexStore`/`fileBlobStore` をディスク上のディレクトリに割り当てる。

```ts
import { createCMS } from "@notion-headless-cms/cms";
import { fileBlobStore, fileIndexStore } from "@notion-headless-cms/cms/node";
import { schema } from "./schema.js";

const cms = createCMS({
  schema,
  notion: { token: process.env.NOTION_TOKEN ?? "" },
  stores: {
    index: fileIndexStore(".nhc-cache/index"),
    blobs: fileBlobStore(".nhc-cache/blobs"),
  },
});
```

`fileIndexStore` は `memoryIndexStore` と同じ in-memory 実装を JSON ファイルへ永続化したもので、
native 依存を持たない。永続化・スケール・全文検索が要る場合は `@notion-headless-cms/sql` の
`sqliteIndexStore`/`libsqlIndexStore`（Node ランタイム向け）を検討する。

同じ用途の CLI ラッパーとして `nhc sync --cache-dir .nhc-cache` もある（`nhc.config.ts` の
`schemaModule` を読んで同じ経路を CLI から叩くだけで、D1/R2 への実書き込みは行わない）。

## HTTP サーバーに発展させる場合

一覧・詳細を JSON/HTML で配信するサーバーに発展させたい場合は、`cms.fetch()` に画像プロキシ
・OGP・Webhook をまとめて委譲できる（[`cloudflare-workers.md`](./cloudflare-workers.md) の
Hono 例を Node ランタイム向けに読み替えたもの、実例は
[`examples/node-hono/`](../../../examples/node-hono/) / [`examples/node-express/`](../../../examples/node-express/)）。

## 関連

- 動作する完全な例: [`examples/minimal-node/`](../../../examples/minimal-node/)
- Node + HTTP サーバー: [`examples/node-hono/`](../../../examples/node-hono/)
- Cloudflare Workers + R2 + D1: [`cloudflare-workers.md`](./cloudflare-workers.md)
- CMS メソッド一覧: [`../api/cms-methods.md`](../api/cms-methods.md)
