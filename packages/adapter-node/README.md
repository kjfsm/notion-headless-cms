# @notion-headless-cms/adapter-node

Node.js 環境向け CMS ファクトリ。`process.env.NOTION_TOKEN` / `NOTION_DATA_SOURCE_ID` を自動で読み取って `@notion-headless-cms/core` の CMS インスタンスを組み立てる。バッチ処理・静的サイト生成・ローカル開発などに使う。

## インストール

```bash
npm install @notion-headless-cms/adapter-node \
  @notionhq/client zod \
  unified remark-parse remark-gfm remark-rehype rehype-stringify
```

`core` / `source-notion` / `renderer` を推移依存として含むが、`source-notion` の `@notionhq/client` / `zod`、`renderer` の `unified` / `remark-*` / `rehype-*` は `peerDependencies` のため、利用側で明示的にインストールする必要がある。

## 使い方

### 最小構成

```ts
import { createNodeCMS } from "@notion-headless-cms/adapter-node";

const cms = createNodeCMS({
  schema: { publishedStatuses: ["公開"] },
  cache: { document: "memory", image: "memory", ttlMs: 5 * 60_000 },
});

const { items } = await cms.cache.read.list();
console.log(items.map((i) => i.slug));
```

環境変数設定例:

```bash
export NOTION_TOKEN=secret_xxx
export NOTION_DATA_SOURCE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

`NOTION_TOKEN` または `NOTION_DATA_SOURCE_ID` が未設定の状態で `createNodeCMS()` を呼ぶと、`CMSError` (`core/config_invalid`) が投げられる。

### 静的サイト生成スクリプト

```ts
import { createNodeCMS } from "@notion-headless-cms/adapter-node";

const cms = createNodeCMS({
  schema: { publishedStatuses: ["公開"] },
  cache: { document: "memory", image: "memory" },
});

const { ok, failed } = await cms.cache.manage.prefetchAll({
  concurrency: 5,
  onProgress: (done, total) => console.log(`${done}/${total}`),
});
console.log(`完了: ${ok}件, 失敗: ${failed}件`);
```

### QueryBuilder

```ts
const page = await cms
  .query()
  .tag("feature")
  .sortBy("publishedAt", "desc")
  .paginate({ page: 1, perPage: 10 })
  .execute();

console.log(`全${page.total}件中 ${page.items.length}件`);

const adj = await cms.query().adjacent("my-post");
console.log("前の記事:", adj.prev?.slug);
console.log("次の記事:", adj.next?.slug);
```

### 型安全なスキーマ

`defineSchema()` の戻り値をそのまま `schema` に渡せる。

```ts
import { createNodeCMS } from "@notion-headless-cms/adapter-node";
import { defineMapping, defineSchema } from "@notion-headless-cms/source-notion";
import { z } from "zod";

const PostSchema = z.object({
  id: z.string(),
  slug: z.string(),
  updatedAt: z.string(),
  status: z.enum(["公開", "下書き"]),
  publishedAt: z.string(),
  title: z.string(),
});
const mapping = defineMapping<z.infer<typeof PostSchema>>({
  slug:        { type: "richText", notion: "Slug" },
  status:      { type: "select",   notion: "Status", published: ["公開"] },
  publishedAt: { type: "date",     notion: "PublishedAt" },
  title:       { type: "title",    notion: "Title" },
});

const cms = createNodeCMS({ schema: defineSchema(PostSchema, mapping) });
```

## API

### `createNodeCMS<T>(opts?): CMS<T>`

| オプション | 型 | 説明 |
|---|---|---|
| `schema` | `SchemaConfig<T> \| NotionSchema<T>` | `publishedStatuses` などの設定、または `defineSchema()` の戻り値 |
| `content` | `ContentConfig` | `imageProxyBase` などのレンダリング設定 |
| `cache` | `"disabled" \| { document?: "memory"; image?: "memory"; ttlMs?: number }` | キャッシュ設定。省略時は `"disabled"`（完全無効化） |

`cache` の内部構造:

- `"disabled"`: document / image 共にキャッシュなし
- `{ document: "memory" }`: ドキュメントのみ `memoryDocumentCache()` を注入（画像は noop）
- `{ image: "memory" }`: 画像のみ `memoryImageCache()` を注入
- `{ document: "memory", image: "memory", ttlMs: 300_000 }`: 両方を有効化

> LRU の上限（`maxItems` / `maxSizeBytes`）を細かく制御したい場合は、`adapter-node` を経由せず `core` の `createCMS` を直接組み立てる。

戻り値は `createCMS<T>()` と同じ `CMS<T>`。ソース／レンダラーは `notionAdapter` + `renderMarkdown` が自動注入される。

### エラー

環境変数未設定時は以下のコードで `CMSError` が投げられる。

```ts
import { isCMSError } from "@notion-headless-cms/core";

try {
  createNodeCMS();
} catch (err) {
  if (isCMSError(err) && err.code === "core/config_invalid") {
    console.error(err.context); // { envVar: "NOTION_TOKEN" | "NOTION_DATA_SOURCE_ID" }
  }
}
```

## 関連パッケージ

- [`@notion-headless-cms/core`](../core) — CMS エンジン本体
- [`@notion-headless-cms/source-notion`](../source-notion) — Notion データソース
- [`@notion-headless-cms/renderer`](../renderer) — Markdown レンダラー
- [`@notion-headless-cms/adapter-cloudflare`](../adapter-cloudflare) — Cloudflare Workers 向けファクトリ
- [`@notion-headless-cms/adapter-next`](../adapter-next) — Next.js ルートハンドラ
