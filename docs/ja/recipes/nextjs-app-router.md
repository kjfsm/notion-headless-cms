---
title: Next.js App Router
description: Next.js で @notion-headless-cms/cms を使う
category: レシピ
order: 1
---

# Next.js App Router レシピ

Vercel の serverless/edge 関数上で `@notion-headless-cms/cms` を動かす構成。完全に動く実装は
[`examples/vercel-nextjs/`](../../../examples/vercel-nextjs/) にある。

このレシピのゴール:

- `createCMS()` インスタンスをモジュールスコープで遅延構築し、`cms.posts.find()` / `list()` を Server Component から呼ぶ
- `cms.fetch()` を catch-all route にマウントして画像プロキシ・OGP・Webhook を配信する
- `<NotionRevalidator>` で Notion 更新時に画面を静かに切り替える

## インストール

```bash
pnpm add @notion-headless-cms/cms @notion-headless-cms/react-renderer @notionhq/client
pnpm add -D @notion-headless-cms/cli
```

## スキーマ定義

v3 は codegen ではなく TypeScript ファーストでスキーマを書く（`nhc pull` は雛形を一度だけ生成する補助コマンド。以降は直接編集して育てる）。

```ts
// app/schema.ts
import { defineCollection, defineSchema, prop } from "@notion-headless-cms/cms";

const posts = defineCollection({
  dataSourceId: process.env.NOTION_DATA_SOURCE_ID ?? "",
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

## CMS インスタンスの作成

```ts
// app/lib/cms.ts
import {
  createCMS,
  createNodeSyncScheduler,
  memoryBlobStore,
  memoryIndexStore,
} from "@notion-headless-cms/cms";
import { schema } from "@/app/schema";

/**
 * Vercel の serverless/edge 関数はインスタンス間でメモリを共有しないため、
 * in-memory store は永続しない（コールドスタートのたびに再同期が必要）。
 * 永続ストレージが要る場合は libSQL/Turso 向けの `@notion-headless-cms/sql`
 * の `libsqlIndexStore` や、Vercel Blob 向けの `BlobStore` 実装に差し替える
 * （`custom-cache.md` 参照）。
 */
type Cms = ReturnType<typeof createCMS<typeof schema>>;

let instance: Cms | undefined;

/**
 * `next build` はルートハンドラの静的解析のためモジュールを import する
 * （実行はしない）。トップレベルで `createCMS()` を呼ぶと、`NOTION_TOKEN` が
 * 無いビルド環境（CI 等）でその import だけでビルドが失敗する。
 * 構築を実際に使う時点まで遅延することでこれを避ける。
 */
export function getCms(): Cms {
  if (!instance) {
    instance = createCMS({
      schema,
      notion: { token: process.env.NOTION_TOKEN ?? "" },
      stores: { index: memoryIndexStore(), blobs: memoryBlobStore() },
      scheduler: createNodeSyncScheduler(),
      webhookSecret: process.env.REVALIDATE_SECRET,
    });
  }
  return instance;
}

let syncing: Promise<void> | null = null;

/** `kick()` は 1 チャンク（既定 2 件）だけ処理する設計なので、cursor が尽きるまで手動で回す。 */
export async function ensureSynced(): Promise<Cms> {
  const cms = getCms();
  if (!syncing) {
    syncing = (async () => {
      let state = await cms.sync.getState();
      do {
        await cms.sync.kick();
        state = await cms.sync.getState();
      } while (state.cursor !== null);
    })();
  }
  await syncing;
  return cms;
}
```

## 一覧ページ（Server Component）

```tsx
// app/page.tsx
import { NotionRevalidator } from "@notion-headless-cms/react-renderer/next";
import Link from "next/link";
import { ensureSynced } from "@/app/lib/cms";

export const revalidate = 300;

export default async function HomePage() {
  const cms = await ensureSynced();
  const { items } = await cms.posts.list();
  return (
    <main>
      {/* ハイドレーション後に router.refresh() を呼び、更新済みデータを別 fetch なしで取り込む */}
      <NotionRevalidator />
      <h1>記事一覧</h1>
      <ul>
        {items.map((post) => (
          <li key={post.slug}>
            <Link href={`/posts/${post.slug}`}>{post.slug}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

## 静的生成（generateStaticParams）と記事ページ

```tsx
// app/posts/[slug]/page.tsx
import { NotionRenderer } from "@notion-headless-cms/react-renderer";
import { denormalizeBlocks, toPageLinkMap } from "@notion-headless-cms/react-renderer/cms";
import { NotionRevalidator } from "@notion-headless-cms/react-renderer/next";
import { notFound } from "next/navigation";
import { ensureSynced } from "@/app/lib/cms";

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    const cms = await ensureSynced();
    const { items } = await cms.posts.list();
    return items.map((item) => ({ slug: item.slug }));
  } catch {
    return [];
  }
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cms = await ensureSynced();
  const post = await cms.posts.find(slug);
  if (!post) notFound();

  return (
    <article>
      <NotionRevalidator />
      <h1>{post.slug}</h1>
      <NotionRenderer
        blocks={denormalizeBlocks(post.blocks)}
        pageLinks={toPageLinkMap(post.links)}
        ogpEndpoint="/api/cms/ogp"
      />
    </article>
  );
}
```

`post.blocks` は同期時に画像 URL 解決・リンク解決まで済んだプレーンな `NormalizedBlock[]`。
`denormalizeBlocks()` で `react-renderer` が期待する `BlockObjectResponse` 形状に変換し、
`toPageLinkMap(post.links)` で内部リンクの href を `pageLinks` に渡すだけでよい。

## 画像配信・Webhook の統合ルート

`cms.fetch()` が画像プロキシ（`GET /api/cms/images/:hash`）・OGP（`GET /api/cms/ogp`）・
Webhook（`POST /api/cms/webhook`）をまとめて配信する。

```ts
// app/api/cms/[...path]/route.ts
// catch-all route。images/ogp を cms.fetch() 1 本に委譲する。
// webhook は revalidatePath も呼びたいため、より具体的な
// app/api/cms/webhook/route.ts が Next.js のルーティング優先順位でこちらより優先される。
import { getCms } from "@/app/lib/cms";

export async function GET(request: Request) {
  return getCms().fetch(request);
}

export async function POST(request: Request) {
  return getCms().fetch(request);
}
```

Webhook 受信時に ISR キャッシュも掃きたい場合は、専用ルートを 1 つ追加して `revalidatePath` を呼ぶ。

```ts
// app/api/cms/webhook/route.ts
// cms.fetch() が署名検証 + debounce 付き同期キックを内部で処理する。sync は
// debounce（既定 3 秒）後に非同期で走るため、Vercel の serverless 関数が
// レスポンス送信後すぐ終了しないよう next/server の after() で少し待ってから
// ISR キャッシュを掃く。
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getCms } from "@/app/lib/cms";

export async function POST(request: Request) {
  const response = await getCms().fetch(request);
  if (response.ok) {
    after(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3500));
      revalidatePath("/");
      revalidatePath("/posts/[slug]", "page");
    });
  }
  return response;
}
```

Notion 側の integration「Webhooks」で `https://<site>/api/cms/webhook` を登録し、
`createCMS({ webhookSecret })` に同じシークレットを渡すと、ページ更新時に `cms.fetch()` が
署名検証 → 同期キックまで面倒を見る（詳細は [`cloudflare-workers.md`](./cloudflare-workers.md) の
「Webhook によるキャッシュ無効化」を参照。仕組みは Next.js でも共通）。

## 環境変数

```
# .env
NOTION_TOKEN=secret_xxx
NOTION_DATA_SOURCE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
REVALIDATE_SECRET=your-secret-here
```

## 関連

- 動作する完全な例: [`examples/vercel-nextjs/`](../../../examples/vercel-nextjs/)
- Cloudflare Workers（D1/R2/DO で永続化する構成）: [`cloudflare-workers.md`](./cloudflare-workers.md)
- レンダラの選び方: [`../choosing-a-renderer.md`](../choosing-a-renderer.md)
- CMS メソッド一覧: [`../api/cms-methods.md`](../api/cms-methods.md)
