---
"@notion-headless-cms/core": minor
"@notion-headless-cms/renderer": minor
"@notion-headless-cms/source-notion": minor
"@notion-headless-cms/cache-r2": patch
"@notion-headless-cms/cache-next": patch
"@notion-headless-cms/adapter-cloudflare": minor
"@notion-headless-cms/adapter-next": minor
"@notion-headless-cms/adapter-node": minor
---

公開前 API 整理。後方互換を壊しうる構造的変更を一括で実施する。

- **source-notion**: 公開 API から `@notionhq/client/build/src/api-endpoints` の内部型を排除し、自前の `NotionPage` 型で置き換え。`@notionhq/client` を `peerDependencies` に昇格
- **source-notion**: `NotionSchema<T>` から `zodSchema` フィールドを削除（`defineSchema()` 内部でクロージャ保持）。`zod` を `peerDependencies` に昇格
- **renderer**: `unified` / `remark-*` / `rehype-*` / `unist-util-visit` を `peerDependencies` へ移動。複数バージョン同居による `Processor` インスタンス不一致問題を回避
- **renderer**: `PluggableList` 型を re-export し、core の `remarkPlugins` / `rehypePlugins` の型を `unknown[]` → `PluggableList` に変更
- **core**: `CacheConfig` を `"disabled" | { document?, image?, ttlMs? }` の discriminated union 化。`false` リテラルを廃止
- **core**: キャッシュアクセサを `cms.cache.read` / `cms.cache.manage` の 3 階層に再編。旧 `cms.cached.*` / `cms.cache.<mutator>` は削除（公開前のため互換レイヤなし）
- **core**: 観測フックを try/catch で囲んで例外を logger に流すようにし、1 つのフックで他のフックが巻き添えにならないように修正
- **core**: `onRenderStart` / `onRenderEnd` フックを追加
- **core**: `memoryDocumentCache` / `memoryImageCache` に `maxItems` / `maxSizeBytes` LRU オプションを追加
- **core**: `exports` に `./errors` / `./hooks` / `./cache/memory` サブパスを追加
- **adapter-cloudflare**: `CreateCloudflareCMSOptions.cache` を廃止し `ttlMs?: number` に簡素化
- **adapter-node**: `NodeCMSOptions.cache` を `"disabled" | { document?: "memory"; image?: "memory"; ttlMs? }` の union に変更
- **リポジトリ**: 統合済みの `packages/fetcher` / `packages/transformer` を削除
- **CI**: Node 18 / 20 / 22 のマトリクスに拡張
