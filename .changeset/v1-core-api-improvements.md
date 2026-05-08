---
"@notion-headless-cms/core": major
"@notion-headless-cms/cache": major
"@notion-headless-cms/notion-source": major
---

v1.0 API 整理 (第1フェーズ): nodePreset 追加・公開 export 整理・CMSError 拡張・cloudflarePreset ctx 必須化

## 破壊的変更

### @notion-headless-cms/core

- `createClient` のサンプルコードを `sources` + `nodePreset()` 形式に刷新
- `ContentConfig.imageProxyBase` を削除（`CreateClientOptions.imageProxyBase` を使うこと）
- 公開 export から `CollectionDef` / `CollectionsConfig` / `InferCollectionItem` / `CollectionClientImpl` / `collectionKey` / `CMSAdapter` / `MergeSourceCollections` を削除（`@notion-headless-cms/core/source-author` サブパスから import すること）
- `CMSError` に `nextSteps?: readonly string[]` / `docsUrl?: string` / `format()` を追加

### @notion-headless-cms/cache

- `cloudflarePreset` の `ctx` が必須になった（省略すると SWR 背景更新が Works ランタイムに打ち切られる）
- テスト用途には `cloudflarePreset.forTest({ env })` を提供

### @notion-headless-cms/notion-source

- `CMSAdapter` / `CollectionDef` の import 元を `@notion-headless-cms/core/source-author` に変更

## 新機能

### @notion-headless-cms/core

- `nodePreset(opts?)` を追加。`...nodePreset()` を `createClient` にスプレッドするだけで Node.js の標準構成（memoryCache + SWR 5 分）が有効になる
- `@notion-headless-cms/core/source-author` サブパスを追加。データソースアダプター実装者向けの型を分離
- `@notion-headless-cms/core/preset/node` サブパスを追加
