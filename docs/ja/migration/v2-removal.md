# v2 アーキテクチャ削除 → `@notion-headless-cms/cms` への移行ガイド

`@notion-headless-cms/client`・`core`・`cache`・`notion-source`・`notion-orm`・`fetch-blocks`・
`fetch-markdown`・`markdown-html`・`block-html`・`notion-katex`・`notion-shiki`・`testing`・
`validate` の13パッケージ（通称 v2）を削除し、`@notion-headless-cms/cms`（通称 v3）に一本化した。

## なぜ

v2/v3 の2アーキテクチャ並存が、16パッケージ + 7 examples + docs の二重保守という最大の固定費に
なっていた。詳細な調査結果と判断根拠は `docs/_internal/dev-improvements-proposal.md` の
「L1. v2/v3 の一本化判断」を参照。

まだ v1→v2 の移行が済んでいない場合は、先に
[`docs/ja/history/migration-v1-to-v2.md`](../history/migration-v1-to-v2.md)（歴史的記録）を
参照して `@notion-headless-cms/client` の `createCMS` へ移行してから、本ガイドで v3 へ移行する。

## パッケージ対応表

| v2 パッケージ | v3 での相当API | 備考 |
|---|---|---|
| `@notion-headless-cms/client`（`createCMS`） | `@notion-headless-cms/cms`（`createCMS`） | 引数の形が全く異なる。下記「`createCMS` の書き換え」参照 |
| `@notion-headless-cms/core` | `@notion-headless-cms/cms`（本体） | `CMSError`/`isCMSError`/`defineCollection`/`defineSchema` 等はすべて `cms` から import する |
| `@notion-headless-cms/cache`（`/cloudflare`） | `@notion-headless-cms/cms/cloudflare`（`kvDocStore`/`r2BlobStore`） | SWR ではなく KV/R2 マテリアライズドレプリカへの参照に置き換わる |
| `@notion-headless-cms/cache`（`/next`） | (なし) | Next.js ISR 連携は無い。`cms` は同期タイミングを自前で持つため `revalidateTag` 等は不要 |
| `@notion-headless-cms/notion-source` / `notion-orm` | `@notion-headless-cms/cms`（`sync/` 内部実装） | ユーザーが直接触る API ではない。`schema` に `defineCollection`/`defineSchema` を書けば同期は自動 |
| `@notion-headless-cms/fetch-blocks` / `fetch-markdown` | (なし。`cms` の同期パイプラインに統合) | ブロック取得は `find()`/`list()` が返す `entry.blocks` で完結する |
| `@notion-headless-cms/markdown-html` / `block-html` | `@notion-headless-cms/cms/html`（`renderBlocksToHtml`） | Markdown 経由ではなく Notion ブロックを直接 HTML 化する |
| `@notion-headless-cms/notion-katex` / `notion-shiki` | `createCMS({ transforms })` | 同期時に事前レンダーする拡張ステージとして統合済み |
| `@notion-headless-cms/testing` | `@notion-headless-cms/cms/testing`（`runDocStoreContract` 等） | ストア契約テストのみ。DataSource のフェイクは無い（`cms` に DataSource 抽象自体が無いため） |
| `@notion-headless-cms/validate` | (廃止。CLI 側の手動チェックに置き換え) | `nhc.config.ts` は TypeScript の型チェックと各コマンドの実行時チェックのみ |

## `createCMS` の書き換え

v2 の `createCMS({ schema, token, content, collections, runtime })` と v3 の
`createCMS({ schema, stores, notion, scheduler, syncDelegate, ... })` は同名だが引数の形が
まったく異なる。書き換えは「作り直し」に近い。設計の違いは `docs/ja/architecture.md` と
`.claude/rules/cms.md` を参照。最小構成の例:

```ts
// v2
import { createCMS } from "@notion-headless-cms/client";
const cms = createCMS({
  schema,
  token: process.env.NOTION_TOKEN!,
  content: "html",
  collections: { posts: { published: ["公開済み"] } },
});

// v3
import { createCMS, defineCollection, defineSchema } from "@notion-headless-cms/cms";

const posts = defineCollection({
  dataSourceId: "...",
  slug: "slug",
  properties: { /* ... */ },
  statusProperty: "status",
  published: ["公開済み"],
});

const cms = createCMS({
  schema: defineSchema({ posts }),
  notion: { token: process.env.NOTION_TOKEN! },
});
```

Cloudflare Workers など KV/R2 を使う場合は `stores`/`syncDelegate` を渡す。詳細は
`docs/ja/quickstart.md`・`docs/ja/recipes/cloudflare-workers.md` を参照。

## `nhc.config.ts` のフラット化

CLI（`@notion-headless-cms/cli`）の設定型 `CMSConfig` から、v2 codegen 用の `output` フィールドと
v3 設定の `v3: {...}` ラッパーキーを廃止し、`scaffoldDir`/`schemaModule`/`collections` を
トップレベルのフィールドにフラット化した。

```ts
// 旧（v2 codegen + v3 併記）
export default defineConfig({
  notionToken: env("NOTION_TOKEN"),
  output: "src/generated/nhc.ts",
  collections: {},
  v3: {
    schemaModule: "src/schema.ts",
    scaffoldDir: "src/collections",
    collections: {
      posts: { dbName: "ブログ記事DB" },
    },
  },
});

// 新（フラット化後）
export default defineConfig({
  notionToken: env("NOTION_TOKEN"),
  schemaModule: "src/schema.ts",
  scaffoldDir: "src/collections",
  collections: {
    posts: { dbName: "ブログ記事DB" },
  },
});
```

## CLI コマンドの変更

- `nhc generate`（Notion DB から `nhc-schema.ts` を codegen）を削除した。スキーマは
  `defineCollection`/`defineSchema` で TS ファーストに書く運用に変わったため、代わりに
  `nhc pull` で雛形コードを生成してから手で育てる。
- `nhc init --template <name>` の複数テンプレート（`node`/`cloudflare-react-router`/
  `cloudflare-hono`/`next`/`cloudflare-v3`）を廃止し、`nhc init`（フラグ無し）が常に
  `@notion-headless-cms/cms` 向けの雛形一式（`nhc.config.ts`・`wrangler.toml`・
  `src/schema.ts`・Hono マウントコード）を生成するようにした。
- `nhc pull`/`nhc check`/`nhc doctor`/`nhc sync` は変更なし（詳細: `docs/ja/cli.md`）。

## `react-renderer` のサブパス改名

`@notion-headless-cms/react-renderer` の `./v3` サブパスを `./cms` に改名した。

```diff
- import { denormalizeBlocks, toPageLinkMap } from "@notion-headless-cms/react-renderer/v3";
+ import { denormalizeBlocks, toPageLinkMap } from "@notion-headless-cms/react-renderer/cms";
```

`denormalizeBlocks`/`toPageLinkMap` 自体の挙動・シグネチャは変わっていない。

## チェックリスト

1. `@notion-headless-cms/client`/`core`/`cache`/`notion-source` 等への依存を `package.json` から削除し、`@notion-headless-cms/cms` に置き換える
2. `createCMS()` の呼び出しを上記の形へ書き換える（`schema` は `defineCollection`/`defineSchema` で TS ファーストに書き直す）
3. `nhc.config.ts` の `v3: {...}` ラッパーをフラット化する（`nhc generate`/`--template` を使っていた場合は削除し `nhc pull`/`nhc init` に置き換える）
4. `@notion-headless-cms/react-renderer/v3` の import を `/cms` に変更する
5. `pnpm install && pnpm typecheck && pnpm test` を実行し、`CMSError` の判定コード（`core/*`・`source/*`・`cache/*` 等）を `cms` の新しい名前空間（`schema/*`・`store/*`・`handler/*`・`sync/*`・`cli/*`。詳細: `docs/ja/errors/index.md`）に置き換える
