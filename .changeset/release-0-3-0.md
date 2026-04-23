---
"@notion-headless-cms/core": minor
"@notion-headless-cms/cli": minor
"@notion-headless-cms/cache-r2": minor
"@notion-headless-cms/cache-kv": minor
"@notion-headless-cms/cache-next": minor
"@notion-headless-cms/renderer": patch
"@notion-headless-cms/adapter-next": patch
---

v0.3.0 リリース前リファクタリング (正式 v1 に向けた骨格整備)。

## 破壊的変更

- **`createCMS` 一本化**: `createNodeCMS` / `createCloudflareCMS` を廃止。
  ランタイム差分は `nodePreset()` (core) と `cloudflarePreset({ env })` (cache-r2) で吸収する。
- **`adapter-node` / `adapter-cloudflare` パッケージ削除**。上記 preset に統合された。
- **`InvalidateScope` を `{ collection, slug? }` に統一**。旧 `{ slug }` / `{ tag }` 形式を削除。
- **NHC プレフィクス → CMS プレフィクス**: `NHCConfig` → `CMSConfig`, `NHCSchema` → `CMSSchema`,
  `nhcDataSources` → `cmsDataSources`, `NHCDataSources` → `CMSDataSources`。
  `nhc` CLI / `nhc.config.ts` / `nhc-schema.ts` のファイル名は維持。
- **CLI / core の生 Error を CMSError に統一**。`cli/*` 名前空間を新設 (`cli/config_invalid`,
  `cli/schema_invalid`, `cli/generate_failed`, `cli/init_failed`, `cli/notion_api_failed`,
  `cli/env_file_not_found`, `cli/config_load_failed`)。
- **`cache-next` の invalidate を規約タグに変更**: `nhc:col:<name>` /
  `nhc:col:<name>:slug:<slug>` を `revalidateTag` する。
- **`DataSourceFactory` を generic 化** (`DataSourceFactory<TOptions>`、
  将来 ORM 増強向けの内部 I/F 整備)。

## 追加

- `nodePreset()` (core): memory cache を既定有効化。`cache` / `ttlMs` / `renderer` で上書き可。
- `cloudflarePreset({ env, ttlMs?, bindings? })` (cache-r2): env binding を自動解決。
  推奨 binding 名 `DOC_CACHE` (KV) / `IMG_BUCKET` (R2)。旧 `CACHE_KV` / `CACHE_BUCKET` もフォールバック認識。
- `BuiltInCMSErrorCode` に `core/notion_orm_missing` / `cli/*` を追加。
- `@notion-headless-cms/cli` に `CMSConfig` / `defineConfig` / `env` を整備。
- Cloudflare KV バックエンドの `kvCache` (cache-kv)。

## 整理

- 全パッケージの `publishConfig.exports` 重複を削除 (root `exports` のみ)。
- `cache-r2` に `test` スクリプトを追加。

## 移行ガイド

詳細は [`docs/migration/v0.3.md`](./docs/migration/v0.3.md) を参照。
