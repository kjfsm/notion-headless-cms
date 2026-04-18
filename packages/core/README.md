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
  schema: {
    publishedStatuses: ["公開"],
    properties: { slug: "Slug" },
  },
  cache: { ttlMs: 5 * 60 * 1000 },
});

// コンテンツ一覧を取得（R2 から返すか Notion API を呼ぶかはキャッシュ状態に依存）
const { items } = await cms.getItems(env);

// スラッグで個別コンテンツを取得（HTML 付き）
const cached = await cms.getItemBySlug("my-post", env);
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
| `getItems(env)` | コンテンツ一覧を返す（キャッシュ優先） |
| `getItemBySlug(slug, env)` | スラッグで個別コンテンツを返す（HTML 付き） |

### ユーティリティ

| エクスポート | 説明 |
|---|---|
| `CacheStore` | JSON/バイナリストレージの抽象ラッパー |
| `isStale(cachedAt, ttlMs)` | TTL 切れ判定 |
| `sha256Hex(data)` | SHA256 ハッシュ生成（画像キー生成に使用） |
| `CMSError` | カスタムエラークラス |

## 主要な型

- `CMSConfig<T>` — CMS 設定オブジェクト
- `BaseContentItem` — デフォルト・カスタム型の基底インターフェース
- `CachedItem<T>` — キャッシュ済みコンテンツ（HTML + メタデータ）
- `StorageAdapter` — ストレージ抽象インターフェース
- `CMSEnv` — 必須環境変数の型

## 関連パッケージ

- [`@notion-headless-cms/adapter-cloudflare`](../adapter-cloudflare) — Cloudflare Workers 向けファクトリー
- [`@notion-headless-cms/cache-r2`](../cache-r2) — R2 ストレージ実装
