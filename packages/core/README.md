# @notion-headless-cms/core

CMS エンジン本体。Notion からのコンテンツ取得・変換・キャッシュを統合管理する。

## インストール

```bash
npm install @notion-headless-cms/core
```

Cloudflare Workers で使う場合は [`@notion-headless-cms/adapter-cloudflare`](../adapter-cloudflare) の利用を推奨する。

## 使い方

```typescript
import { CMS } from "@notion-headless-cms/core";

const cms = new CMS({
  env: {
    NOTION_TOKEN: process.env.NOTION_TOKEN!,
    NOTION_DATA_SOURCE_ID: process.env.NOTION_DATA_SOURCE_ID!,
  },
  schema: {
    publishedStatuses: ["公開"],
    properties: { slug: "Slug" },
  },
  cache: { ttlMs: 5 * 60 * 1000 },
});

// コンテンツ一覧を取得
const { items } = await cms.getItems();

// スラッグで個別コンテンツを取得（HTML 付き）
const cached = await cms.getItemBySlug("my-post");
console.log(cached?.html);
```

### カスタムコンテンツ型

`BaseContentItem` を拡張することで任意のプロパティを追加できる。

```typescript
import type { BaseContentItem, CMSConfig } from "@notion-headless-cms/core";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

interface MyPost extends BaseContentItem {
  title: string;
  category: string;
}

const config: CMSConfig<MyPost> = {
  env: {
    NOTION_TOKEN: process.env.NOTION_TOKEN!,
    NOTION_DATA_SOURCE_ID: process.env.NOTION_DATA_SOURCE_ID!,
  },
  schema: {
    mapItem: (page: PageObjectResponse): MyPost => ({
      id: page.id,
      slug: /* ... */ "",
      status: /* ... */ "",
      publishedAt: page.created_time,
      updatedAt: page.last_edited_time,
      title: /* ... */ "",
      category: /* ... */ "",
    }),
  },
};
```

## 主要 API

### `CMS` クラス

| メソッド | 説明 |
|---|---|
| `getItems()` | コンテンツ一覧を返す |
| `getItemBySlug(slug)` | スラッグで個別コンテンツを返す |
| `renderItem(item)` | アイテムをレンダリングして `CachedItem` を返す |
| `renderItemBySlug(slug)` | スラッグで取得してレンダリングする |
| `getItemsCachedFirst(options?)` | キャッシュ優先でコンテンツ一覧を返す（SWR） |
| `getItemCachedFirst(slug, options?)` | キャッシュ優先で個別コンテンツを返す（SWR） |
| `checkItemsUpdate(clientVersion)` | 一覧の更新有無を確認する |
| `checkItemUpdate(slug, lastEdited)` | 個別コンテンツの更新有無を確認する |

### ユーティリティ

| エクスポート | 説明 |
|---|---|
| `CacheStore` | JSON/バイナリストレージの抽象ラッパー |
| `isStale(cachedAt, ttlMs)` | TTL 切れ判定 |
| `sha256Hex(data)` | SHA256 ハッシュ生成（画像キー生成に使用） |
| `CMSError` | カスタムエラークラス |

## 主要な型

- `CMSConfig<T>` — CMS 設定オブジェクト（`env` フィールドで認証情報を渡す）
- `BaseContentItem` — デフォルト・カスタム型の基底インターフェース
- `CachedItem<T>` — キャッシュ済みコンテンツ（HTML + メタデータ）
- `StorageAdapter` — ストレージ抽象インターフェース
- `CMSEnv` — 必須環境変数の型

## 関連パッケージ

- [`@notion-headless-cms/adapter-cloudflare`](../adapter-cloudflare) — Cloudflare Workers 向けファクトリー
- [`@notion-headless-cms/cache-r2`](../cache-r2) — R2 ストレージ実装
