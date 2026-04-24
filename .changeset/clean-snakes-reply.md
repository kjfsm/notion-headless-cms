---
"@notion-headless-cms/cli": major
"@notion-headless-cms/core": minor
"@notion-headless-cms/notion-orm": minor
---

feat: createCMS コレクション検証・公開条件指定、generate 全プロパティ出力

### @notion-headless-cms/cli（破壊的変更）

- `nhc generate` の生成スキーマ形式を刷新。Zod / `defineSchema` / `cmsDataSources` を廃止し、`{name}SourceId` と `{name}Properties` のみを生成するシンプルな形式に変更
- `nhc.config.ts` の `DataSourceConfig.fields` を削除し `columnMappings` に変更（非ASCII列名のマッピング専用）
- 非ASCII プロパティ名は `property_1`, `property_2`... に自動変換し warn を出力
- `columnMappings` で明示マッピング可能、存在しないプロパティを指定した場合はエラー

### @notion-headless-cms/core（後方互換）

- `createCMS` に `collections` オプションを追加（`CollectionSemantics` 型）
- `collections[name].slug` が未指定の場合に `CMSError(core/config_invalid)` をスロー
- `collections[name].publishedStatuses` / `accessibleStatuses` を DataSource 側の設定より優先して適用
- 新型エクスポート: `CollectionSemantics`, `PropertyDef`, `PropertyMap`
- `DataSource.findBySlug` を optional に変更、`findByProp?` と `readonly properties?: PropertyMap` を追加

### @notion-headless-cms/notion-orm（後方互換）

- `createNotionCollection` に `properties` オプションを追加（PropertyMap ベースのマッピング）
- `findByProp(notionPropName, value)` メソッドを実装（Core が slug ルックアップに利用）
- 内部に `queryPageByProp` を追加（Notion API のプロパティフィルタクエリ）
