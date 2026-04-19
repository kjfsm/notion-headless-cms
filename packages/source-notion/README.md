# @notion-headless-cms/source-notion

Notion を `@notion-headless-cms/core` のデータソースとして利用するためのアダプタ。  
Notion データベースからページを取得し、`DataSourceAdapter` インターフェースを実装する。

## インストール

```bash
npm install @notion-headless-cms/source-notion @notion-headless-cms/core
```

## 使い方

### 基本（`notionAdapter`）

```typescript
import { notionAdapter } from "@notion-headless-cms/source-notion";
import { createCMS } from "@notion-headless-cms/core";

const cms = createCMS({
  source: notionAdapter({
    token: process.env.NOTION_TOKEN!,
    dataSourceId: process.env.NOTION_DATA_SOURCE_ID!,
  }),
  schema: {
    publishedStatuses: ["公開"],
  },
});

const items = await cms.list();
```

---

### 型安全なスキーマ定義（`defineSchema` + `col`）

`col` ヘルパーと `defineSchema` 関数を使うと、Notion DB のカラム定義から TypeScript 型を自動推論できる。

```typescript
import { col, defineSchema, notionAdapter } from "@notion-headless-cms/source-notion";
import { createCMS } from "@notion-headless-cms/core";

const blogSchema = defineSchema({
  // システムフィールド（slug / status / publishedAt は必須）
  slug:        col.richText("Slug"),
  publishedAt: col.date("公開日", { default: (page) => page.created_time }),
  status: col.select("ステータス", {
    values:     { "公開済み": "published", "下書き": "draft" },
    published:  ["published"],          // list() でフィルタされる値
    accessible: ["published", "draft"], // findBySlug() でアクセス可能な値
  }),

  // カスタムフィールド
  title:     col.title("タイトル", { default: "無題" }),
  author:    col.richText("著者"),
  category:  col.select("カテゴリ", {
    values: { "技術": "tech", "デザイン": "design" },
  }),
  tags:      col.multiSelect("タグ"),
  featured:  col.checkbox("特集"),
  viewCount: col.number("閲覧数", { default: 0 }),
});

const cms = createCMS({
  source: notionAdapter({
    token: process.env.NOTION_TOKEN!,
    dataSourceId: process.env.NOTION_DATA_SOURCE_ID!,
    schema: blogSchema,
  }),
});

const items = await cms.list();
items[0].title     // string     （default 指定 → null なし）
items[0].author    // string | null （default 未指定 → null あり）
items[0].category  // "tech" | "design" | null
items[0].status    // "published" | "draft"
items[0].featured  // boolean
items[0].tags      // string[]
```

#### 推論される型

| カラム定義 | TypeScript 型 |
|-----------|--------------|
| `col.title(...)` | `string \| null` |
| `col.title(..., { default: "無題" })` | `string` |
| `col.richText(...)` | `string \| null` |
| `col.date(...)` | `string \| null` |
| `col.number(...)` | `number \| null` |
| `col.number(..., { default: 0 })` | `number` |
| `col.checkbox(...)` | `boolean`（常に非 null） |
| `col.url(...)` | `string \| null` |
| `col.multiSelect(...)` | `string[]`（常に非 null） |
| `col.select("...", { values: { A: "a", B: "b" } })` | `"a" \| "b" \| null` |
| `col.select(..., { values: ..., default: "a" })` | `"a" \| "b"` |

> `checkbox` と `multiSelect` は値が存在しない場合でも `false` / `[]` を返すため、常に非 null。

#### `default` オプション

固定値または `(page: PageObjectResponse) => T` の動的関数を指定できる。  
Notion プロパティが未設定・空の場合のフォールバックとして使われる。

```typescript
col.date("公開日", { default: (page) => page.created_time })  // 動的デフォルト
col.number("閲覧数", { default: 0 })                          // 固定値
```

---

### カスタム `mapItem`（既存パターン）

引き続き `mapItem` 関数を手書きして独自の変換ロジックを実装できる。

```typescript
import type { BaseContentItem } from "@notion-headless-cms/core";
import { notionAdapter } from "@notion-headless-cms/source-notion";

interface MyPost extends BaseContentItem {
  title: string;
}

const source = notionAdapter<MyPost>({
  token: process.env.NOTION_TOKEN!,
  dataSourceId: process.env.NOTION_DATA_SOURCE_ID!,
  mapItem: (page) => ({
    id: page.id,
    slug: (page.properties["Slug"] as any).rich_text[0]?.plain_text ?? "",
    status: (page.properties["Status"] as any).status?.name ?? "",
    publishedAt: (page.properties["PublishedAt"] as any).date?.start ?? page.created_time,
    updatedAt: page.last_edited_time,
    title: (page.properties["Title"] as any).title[0]?.plain_text ?? "",
  }),
});
```

---

## API

### `notionAdapter(opts)`

`DataSourceAdapter` を返すファクトリ関数。

| オプション | 型 | 説明 |
|-----------|-----|------|
| `token` | `string` | Notion API 認証トークン |
| `dataSourceId` | `string` | Notion データベース ID |
| `schema` | `NotionSchema<T>` | `defineSchema()` で生成したスキーマ（型安全） |
| `properties` | `CMSSchemaProperties` | プロパティ名マッピング（`schema` 未使用時） |
| `mapItem` | `(page) => T` | カスタムマッパー（`schema` 未使用時） |
| `blocks` | `Record<string, BlockHandler>` | カスタムブロックハンドラー |

`schema` / `mapItem` / `properties` は優先順位: `schema` > `mapItem` > `properties`（デフォルト）。

### `defineSchema(columns)`

カラム定義マップからスキーマオブジェクトを生成する。  
`slug` / `status` / `publishedAt` の 3 フィールドは必須。

### `col`

各 Notion プロパティ型に対応するカラム定義ヘルパー。

```typescript
col.title(notion: string, opts?: { default?: string | (page) => string })
col.richText(notion: string, opts?: { default?: string | (page) => string })
col.date(notion: string, opts?: { default?: string | (page) => string })
col.number(notion: string, opts?: { default?: number | (page) => number })
col.checkbox(notion: string, opts?: { default?: boolean })
col.url(notion: string, opts?: { default?: string | (page) => string })
col.multiSelect(notion: string, opts?: { default?: string[] })
col.select(notion: string, opts?: {
  values?: Record<string, string>  // Notion表示名 → コード値マッピング
  published?: string[]             // list() でフィルタするコード値
  accessible?: string[]            // findBySlug() でアクセス可能なコード値
  default?: string | (page) => string
})
```
