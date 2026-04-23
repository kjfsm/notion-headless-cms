---
"@notion-headless-cms/adapter-cloudflare": patch
"@notion-headless-cms/adapter-node": patch
"@notion-headless-cms/source-notion": patch
"@notion-headless-cms/core": patch
"@notion-headless-cms/cli": patch
---

単一ソース CMS を廃止し `createNodeCMS` / `createCloudflareCMS` をマルチソース一本化しました（破壊的変更）。

- `createCloudflareCMSMulti` / `createNodeMultiCMS` を `createCloudflareCMS` / `createNodeCMS` に改名し、旧単一ソース版のファクトリは削除しました。`nhc generate` が生成した `nhcSchema` を渡すと、ソース名でアクセスできる `CMS` のマップが返ります。
- `MultiSourceEntry` / `MultiSourceSchema` / `MultiCMSResult` を `SourceEntry` / `NHCSchema` / `CMSMap` に改名し、`@notion-headless-cms/source-notion` に一元化しました（両アダプタで重複していた定義を削除）。
- `CloudflareCMSEnv` から `NOTION_DATA_SOURCE_ID` / `DB_NAME` を削除しました。各ソースの `dataSourceId` は `nhcSchema` から取得されます。
- Notion fetcher のページネーションを `paginate()` ヘルパーに共通化し、`QueryBuilder` のソート・ステータス解決処理を private メソッドに抽出しました。
- `core/cms.ts` から `buildCachedItem` を `rendering.ts` に分離し、責務を整理しました。
- `notionAdapter` のオーバーロードを整理し、`as unknown as T` キャストを解消しました。
- `Logger` の `context` を `LogContext` 型で構造化しました（後方互換あり）。`tsconfig.json` に `useUnknownInCatchVariables` を明示しました。
- CLI の `notion-client` のエラー判定を `getErrorCode` ヘルパーに統合しました（挙動変更なし）。
