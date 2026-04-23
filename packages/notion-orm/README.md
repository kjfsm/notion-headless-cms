# @notion-headless-cms/source-notion

Notion を `@notion-headless-cms/core` のデータソースとして利用するためのアダプタ。
`DataSourceAdapter` インターフェースを実装し、Notion DB からページ取得・Markdown 変換を行う。

## インストール

```bash
npm install @notion-headless-cms/source-notion @notion-headless-cms/core \
  @notionhq/client zod
```

`@notionhq/client` と `zod` は `peerDependencies`。公開 API の型が `@notionhq/client` の `PageObjectResponse` に依存しており、`zod` は `defineSchema` のバリデーションに必要なため、利用側アプリのバージョンと一致させる。

## 使い方

### 最小構成（`notionAdapter`）

`Slug` / `Status` / `CreatedAt` というデフォルトのプロパティ名に従う場合は、`notionAdapter` をトークンと data source ID だけで呼び出せる。

```typescript
import { createCMS } from "@notion-headless-cms/core";
import { notionAdapter } from "@notion-headless-cms/source-notion";

const cms = createCMS({
  source: notionAdapter({
    token: process.env.NOTION_TOKEN!,
    dataSourceId: process.env.NOTION_DATA_SOURCE_ID!,
  }),
  schema: { publishedStatuses: ["公開"] },
});

const items = await cms.list();
```

プロパティ名を変更したい場合は `properties` を渡す。

```typescript
notionAdapter({
  token: process.env.NOTION_TOKEN!,
  dataSourceId: process.env.NOTION_DATA_SOURCE_ID!,
  properties: { slug: "Slug", status: "Status", date: "PublishedAt" },
});
```

---

### 型安全なスキーマ定義（`defineSchema` + Zod）

Zod スキーマと Notion プロパティのマッピングを同時に宣言することで、`cms.list()` / `cms.find()` の返す型を推論させられる。

```typescript
import { createCMS } from "@notion-headless-cms/core";
import {
  defineMapping,
  defineSchema,
  notionAdapter,
} from "@notion-headless-cms/source-notion";
import { z } from "zod";

const PostSchema = z.object({
  id: z.string(),
  slug: z.string(),
  updatedAt: z.string(),
  status: z.enum(["公開", "下書き"]),
  publishedAt: z.string(),
  title: z.string(),
  tags: z.array(z.string()),
  featured: z.boolean(),
});
type Post = z.infer<typeof PostSchema>;

const mapping = defineMapping<Post>({
  slug:        { type: "richText", notion: "Slug" },
  status:      {
    type: "select",
    notion: "Status",
    published: ["公開"],
    accessible: ["公開", "下書き"],
  },
  publishedAt: { type: "date",        notion: "PublishedAt" },
  title:       { type: "title",       notion: "Title" },
  tags:        { type: "multiSelect", notion: "Tags" },
  featured:    { type: "checkbox",    notion: "Featured" },
});

const schema = defineSchema(PostSchema, mapping);

const cms = createCMS<Post>({
  source: notionAdapter<Post>({
    token: process.env.NOTION_TOKEN!,
    dataSourceId: process.env.NOTION_DATA_SOURCE_ID!,
    schema,
  }),
});

const items = await cms.list();
items[0].title;    // string
items[0].tags;     // string[]
items[0].featured; // boolean
items[0].status;   // "公開" | "下書き"
```

- `defineMapping<T>(mapping)` は型レベルで `mapping` のキーを `T` のキーと一致させる恒等関数。`id` / `updatedAt` は Notion のメタデータから自動設定されるため指定不要。
- `defineSchema(zodSchema, mapping)` は Notion ページ → プレーンオブジェクト → `zodSchema.parse` の順で変換する `NotionSchema<T>` を返す。バリデーションに失敗した場合は `CMSError` (`core/schema_invalid`) が投げられる。
- `select` プロパティの `published` / `accessible` は `cms.list()` / `cms.find()` で使用する状態フィルタに流し込まれる。

---

### カスタム `mapItem`

Zod を使わずに独自の変換ロジックを書く場合は `mapItem` を渡す。`schema` 指定時は `mapItem` / `properties` は無視される。

`mapItem` の引数型は `source-notion` が再エクスポートしている `NotionPage` を使う（`@notionhq/client` の `PageObjectResponse` と構造互換）。`getPlainText` に渡す要素は `NotionRichTextItem`。

```typescript
import type { BaseContentItem } from "@notion-headless-cms/core";
import {
  getPlainText,
  notionAdapter,
  type NotionPage,
} from "@notion-headless-cms/source-notion";

interface MyPost extends BaseContentItem {
  title: string;
}

function toPost(page: NotionPage): MyPost {
  const slugProp = page.properties.Slug;
  const statusProp = page.properties.Status;
  const publishedProp = page.properties.PublishedAt;
  const titleProp = page.properties.Title;

  return {
    id: page.id,
    slug:
      slugProp.type === "rich_text" ? getPlainText(slugProp.rich_text) : "",
    status:
      statusProp.type === "status" ? statusProp.status?.name : undefined,
    publishedAt:
      publishedProp.type === "date"
        ? (publishedProp.date?.start ?? page.created_time)
        : page.created_time,
    updatedAt: page.last_edited_time,
    title:
      titleProp.type === "title" ? getPlainText(titleProp.title) : "",
  };
}

const source = notionAdapter<MyPost>({
  token: process.env.NOTION_TOKEN!,
  dataSourceId: process.env.NOTION_DATA_SOURCE_ID!,
  mapItem: toPost,
});
```

---

## API

### `notionAdapter<T>(opts): DataSourceAdapter<T>`

| オプション | 型 | 説明 |
|---|---|---|
| `token` | `string` | Notion API 認証トークン（必須） |
| `dataSourceId` | `string` | Notion データベース ID（必須） |
| `schema` | `NotionSchema<T>` | `defineSchema()` で生成したスキーマ。指定時は他より優先 |
| `mapItem` | `(page) => T` | Notion ページを `T` に変換する関数 |
| `properties` | `CMSSchemaProperties` | プロパティ名マッピング（`schema` / `mapItem` 未使用時のみ有効） |
| `blocks` | `Record<string, BlockHandler>` | カスタムブロックハンドラ |

優先順位: `schema` > `mapItem` > `properties`（デフォルト）。

### `defineMapping<T>(mapping)`

`T` のキー（`id` / `updatedAt` を除く）を漏れなくカバーする `NotionFieldType` マップを型チェック付きで宣言するヘルパー。ランタイムは恒等関数。

### `defineSchema(zodSchema, mapping): NotionSchema<T>`

Zod オブジェクトスキーマと `defineMapping` の結果を結合し、Notion ページ → `T` への変換関数を含む `NotionSchema` を返す。`select` フィールドに設定した `published` / `accessible` はフィルタ用途に集約される。

### `NotionFieldType`

`notion` はフィールドが紐付く Notion プロパティ名。

| `type` | 追加プロパティ | 意味 |
|---|---|---|
| `"title"` | — | タイトル → プレーンテキスト |
| `"richText"` | — | リッチテキスト → プレーンテキスト |
| `"url"` | — | URL（null あり） |
| `"checkbox"` | — | チェックボックス（boolean、未設定は `false`） |
| `"date"` | — | 日付の `start` 文字列 |
| `"number"` | — | 数値 |
| `"multiSelect"` | — | 名前の配列（未設定は `[]`） |
| `"select"` | `published?` / `accessible?` | セレクトまたはステータス。`published` は `cms.list()` がデフォルトで返す値、`accessible` は `cms.find()` で取得できる値 |

Notion プロパティが存在しない場合、`checkbox` は `false`、`multiSelect` は `[]`、それ以外は `null` が返る。

### ユーティリティ

| エクスポート | 説明 |
|---|---|
| `mapItem(page, props)` | デフォルトマッパー（`schema` / `mapItem` 未指定時の実装） |
| `getPlainText(items)` | Notion のリッチテキスト配列をプレーンテキストに結合 |

### 型

| 型 | 説明 |
|---|---|
| `NotionAdapterOptions<T>` | `notionAdapter()` の引数 |
| `NotionSchema<T>` | `defineSchema()` の戻り値 |
| `NotionFieldType` | `defineMapping` の各フィールドで指定する型 |
| `NotionPage` | `@notionhq/client` の `PageObjectResponse` を再エクスポート（`mapItem` の引数型） |
| `NotionRichTextItem` | `@notionhq/client` の `RichTextItemResponse` を再エクスポート（`getPlainText` の引数型） |

## エラー体系

Notion 取得・Markdown 変換の失敗は `CMSError` で統一される。

| code | 契機 |
|---|---|
| `source/fetch_items_failed` | `cms.list()` 中の API 失敗 |
| `source/fetch_item_failed` | `cms.find()` 中の API 失敗 |
| `source/load_markdown_failed` | `cms.render()` のブロック変換失敗 |
| `core/schema_invalid` | `defineSchema` / デフォルトマッパーの Zod バリデーション失敗 |

```ts
import { isCMSErrorInNamespace } from "@notion-headless-cms/core";

try {
  await cms.list();
} catch (err) {
  if (isCMSErrorInNamespace(err, "source/")) {
    // Notion 取得系エラー
  }
}
```

## 関連パッケージ

- [`@notion-headless-cms/core`](../core) — CMS 本体
- [`@notion-headless-cms/renderer`](../renderer) — Markdown → HTML
- [`@notion-headless-cms/adapter-node`](../adapter-node) — Node.js 向けファクトリ
- [`@notion-headless-cms/adapter-cloudflare`](../adapter-cloudflare) — Cloudflare Workers 向けファクトリ
- [`@notion-headless-cms/adapter-next`](../adapter-next) — Next.js ルートハンドラ
