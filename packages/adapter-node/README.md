# @notion-headless-cms/adapter-node

Node.js 環境向け CMS ファクトリ。`nhc generate` が生成した `nhcSchema` を受け取り、`process.env.NOTION_TOKEN` を自動で読み取って各ソースに対応する `CMS` インスタンスのマップを組み立てる。バッチ処理・静的サイト生成・ローカル開発などに使う。

## インストール

```bash
npm install @notion-headless-cms/adapter-node \
  @notionhq/client zod \
  unified remark-parse remark-gfm remark-rehype rehype-stringify
npm install -D @notion-headless-cms/cli
```

`core` / `source-notion` / `renderer` を推移依存として含むが、`source-notion` の `@notionhq/client` / `zod`、`renderer` の `unified` / `remark-*` / `rehype-*` は `peerDependencies` のため、利用側で明示的にインストールする必要がある。

## 使い方

### スキーマの生成

```bash
npx nhc init
NOTION_TOKEN=secret_xxx npx nhc generate
```

### 最小構成

```ts
import { createNodeCMS } from "@notion-headless-cms/adapter-node";
import { nhcSchema } from "./generated/nhc-schema";

const client = createNodeCMS({
  schema: nhcSchema,
  sources: {
    posts: { published: ["公開"] },
  },
  cache: { document: "memory", image: "memory", ttlMs: 5 * 60_000 },
});

const { items } = await client.posts.cache.getList();
console.log(items.map((i) => i.slug));
```

環境変数設定例:

```bash
export NOTION_TOKEN=secret_xxx
```

`NOTION_TOKEN` が未設定かつ `token` オプションも未指定の場合、`CMSError` (`core/config_invalid`) が投げられる。

### 静的サイト生成スクリプト

```ts
import { createNodeCMS } from "@notion-headless-cms/adapter-node";
import { nhcSchema } from "./generated/nhc-schema";

const client = createNodeCMS({
  schema: nhcSchema,
  cache: { document: "memory", image: "memory" },
});

const { ok, failed } = await client.posts.cache.prefetchAll({
  concurrency: 5,
  onProgress: (done, total) => console.log(`${done}/${total}`),
});
console.log(`完了: ${ok}件, 失敗: ${failed}件`);
```

### QueryBuilder

```ts
const page = await client.posts
  .query()
  .tag("feature")
  .sortBy("publishedAt", "desc")
  .paginate({ page: 1, perPage: 10 })
  .execute();

console.log(`全${page.total}件中 ${page.items.length}件`);

const adj = await client.posts.query().adjacent("my-post");
console.log("前の記事:", adj.prev?.slug);
console.log("次の記事:", adj.next?.slug);
```

## API

### `createNodeCMS<S>(opts): CMSMap<S>`

| オプション | 型 | 説明 |
|---|---|---|
| `schema` | `NHCSchema` | `nhc generate` が生成した `nhcSchema` |
| `sources` | `{ [K in keyof S]?: SourceStatusConfig }`（任意） | ソースごとの `published` / `accessible` 設定 |
| `token` | `string`（任意） | Notion API トークン（省略時は `NOTION_TOKEN` 環境変数） |
| `cache` | `"disabled" \| { document?: "memory"; image?: "memory"; ttlMs?: number }`（任意） | キャッシュ設定。省略時は `"disabled"`（完全無効化） |
| `content` | `ContentConfig`（任意） | `imageProxyBase` などのレンダリング設定 |

`cache` の内部構造:

- `"disabled"`: document / image 共にキャッシュなし
- `{ document: "memory" }`: ドキュメントのみ `memoryDocumentCache()` を注入（画像は noop）
- `{ image: "memory" }`: 画像のみ `memoryImageCache()` を注入
- `{ document: "memory", image: "memory", ttlMs: 300_000 }`: 両方を有効化

> LRU の上限（`maxItems` / `maxSizeBytes`）を細かく制御したい場合や、`nextCache` などカスタムキャッシュを使いたい場合は、`adapter-node` を経由せず `core` の `createCMS` を直接組み立てる。

戻り値 `CMSMap<S>` は `{ [K in keyof S]: CMS<InferredItem<S[K]>> }` のマップ型。各値は通常の `CMS<T>` インスタンスと同じメソッドを持つ。

### エラー

環境変数未設定時は以下のコードで `CMSError` が投げられる。

```ts
import { isCMSError } from "@notion-headless-cms/core";

try {
  createNodeCMS({ schema: nhcSchema });
} catch (err) {
  if (isCMSError(err) && err.code === "core/config_invalid") {
    console.error(err.context); // { envVar: "NOTION_TOKEN" }
  }
}
```

## 関連パッケージ

- [`@notion-headless-cms/core`](../core) — CMS エンジン本体
- [`@notion-headless-cms/source-notion`](../source-notion) — Notion データソース
- [`@notion-headless-cms/renderer`](../renderer) — Markdown レンダラー
- [`@notion-headless-cms/adapter-cloudflare`](../adapter-cloudflare) — Cloudflare Workers 向けファクトリ
- [`@notion-headless-cms/adapter-next`](../adapter-next) — Next.js ルートハンドラ
- [`@notion-headless-cms/cli`](../cli) — `nhcSchema` 生成 CLI
