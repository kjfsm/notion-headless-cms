---
title: クイックスタート
description: 5 分で notion-headless-cms を動かす
category: はじめに
order: 1
---

# クイックスタート（5分で動かす）

## 必要なもの

- Notion API トークン（[Notion Developers](https://www.notion.so/my-integrations) で取得）
- Notion データベース（インテグレーションを「接続先」に追加しておく）
- Node.js 24 以降

## アーキテクチャの前提

`@notion-headless-cms/cms` は **読者リクエスト処理中に Notion API を一切呼ばない**。
`find()`/`list()`/`search()` は index（D1/SQLite/libSQL 等）/R2（entry 本体・画像）の
マテリアライズドレプリカを読むだけで完結し、Notion との同期は webhook 駆動の非同期処理として
別に走る。D1/R2 が無い環境（ローカル・お試し）では in-memory ストアに自動フォールバックするため、
まずは Notion トークンだけで動かせる。

## インストール

```bash
pnpm add @notion-headless-cms/cms @notionhq/client
pnpm add -D @notion-headless-cms/cli
```

`cms` は他の workspace パッケージに依存しないゼロ依存パッケージ。`@notionhq/client` は peer 依存のため利用側でインストールする（`katex`/`shiki`/`vitest` は任意の peer 依存で、使う機能に応じて追加すればよい）。

## スキーマを書く

v3 の現行アーキテクチャは codegen ではなく **TypeScript ファースト**でスキーマを書く（`defineCollection`/`defineSchema`）。

```ts
// src/schema.ts
import { defineCollection, defineSchema, prop } from "@notion-headless-cms/cms";

export const schema = defineSchema({
  posts: defineCollection({
    dataSourceId: "abc-123-def-456", // Notion の data_source_id
    slug: "slug",
    statusProperty: "status",
    published: ["公開済み"],
    properties: {
      title: prop.title("名前"), // スキーマキーが実名と違う場合は実名を渡す
      slug: prop.richText("URL"),
      status: prop.status(["下書き", "公開済み"] as const, "ステータス"),
    },
  }),
});
```

`dataSourceId` や実際の Notion プロパティ名を手で調べるのが手間な場合は、CLI の `nhc pull` が対象 DB を introspect して雛形コードを生成してくれる（詳細は [CLI ツール](./cli.md) を参照）。

```bash
npx nhc init   # nhc.config.ts などの設定一式を生成
npx nhc pull   # 対象 DB を introspect し、defineCollection の雛形を出力
npx nhc check  # スキーマと実 DB の drift を検証（CI 向け）
```

`nhc pull`/`nhc init` が生成するファイルは既存ファイルを上書きしない。生成後は自分のコードとして育てていく運用で、以降 Notion 側でプロパティを追加・変更したら `schema.ts` を直接編集する。

## 最小構成（Node・D1/R2 無し）

```ts
import { createCMS } from "@notion-headless-cms/cms";
import { schema } from "./src/schema";

const cms = createCMS({
  schema,
  notion: { token: process.env.NOTION_TOKEN! },
});

// ローカル同期を開始する（初回 kick）
await cms.sync.kick();

// 一覧取得（既定 limit=20、{ items, nextCursor, hasMore }）
const { items } = await cms.posts.list();

// スラッグで 1 件取得
const post = await cms.posts.find("my-first-post");
if (post) {
  console.log(post.meta); // コレクション固有のプロパティ値
  console.log(post.blocks); // 正規化済みブロック（本文）
}
```

`stores`（index/blobs）を省略すると in-memory ストアにフォールバックする。永続化やエッジ配信が必要になったら `stores: { index, blobs }` を渡すだけでよい。

## Cloudflare Workers の場合

Workers + D1 + R2 + Durable Objects で「読者用の stateless Worker」と「同期を直列化する Durable Object」を分離するのが既定の構成。`nhc init` はこの構成一式（`wrangler.toml`・`src/schema.ts`・Hono マウントコード）をそのまま生成する。index ストアは `@notion-headless-cms/sql/d1` の `d1IndexStore(env.DB, schema)`（`wrangler.toml` の `[[d1_databases]]` binding）を使う。

```ts
// workers/sync-coordinator-do.ts（Notion 同期を担う DO）
import { createCMS, createDurableObjectSyncScheduler } from "@notion-headless-cms/cms";
import { createSyncCoordinatorDO, r2BlobStore } from "@notion-headless-cms/cms/cloudflare";
import { d1IndexStore } from "@notion-headless-cms/sql/d1";
import { schema } from "../src/schema";

export const SyncCoordinatorDO = createSyncCoordinatorDO<Env>({
  createCMS: (state, env) =>
    createCMS({
      schema,
      notion: { token: env.NOTION_TOKEN },
      stores: {
        index: d1IndexStore(env.DB, schema),
        blobs: r2BlobStore(env.ENTRY_BUCKET),
      },
      scheduler: createDurableObjectSyncScheduler(state),
    }),
});
```

```ts
// workers/cms.ts（読者用 stateless Worker。D1/R2 読み取りのみ）
import { createCMS } from "@notion-headless-cms/cms";
import { durableObjectSyncDelegate, r2BlobStore } from "@notion-headless-cms/cms/cloudflare";
import { d1IndexStore } from "@notion-headless-cms/sql/d1";
import { schema } from "../src/schema";

export function getCMS(env: Env) {
  return createCMS({
    schema,
    stores: {
      index: d1IndexStore(env.DB, schema),
      blobs: r2BlobStore(env.ENTRY_BUCKET),
    },
    syncDelegate: durableObjectSyncDelegate({ namespace: env.SYNC_COORDINATOR }),
  });
}

export default {
  async fetch(req: Request, env: Env) {
    const cms = getCMS(env);
    const posts = await cms.posts.list();
    return Response.json(posts);
  },
};
```

読者側は `syncDelegate` を渡すため `notion`/`scheduler` は不要（Notion アクセスは DO 側に一元化される）。同期のトリガーは Notion webhook（`POST /api/cms/webhook` → DO の `onWebhook()`）で、DO 自身の `alarm()` が変更を使い切るまで自己継続する。

## 次のステップ

- [CLI ツール（nhc）](./cli.md)
- [エラーコード一覧](./errors/index.md)
- [他ヘッドレス CMS との比較](./comparison.md)
- [設計思想（architecture.md）](./architecture.md)
