---
"@notion-headless-cms/source-notion": patch
"@notion-headless-cms/core": patch
---

宣言的スキーマ定義（`col` / `defineSchema`）を追加し、Notion DBカラムの型を自動推論できるようにした。

## source-notion

- `col` ヘルパーを追加: `title` / `richText` / `date` / `number` / `checkbox` / `url` / `multiSelect` / `select` の各カラム定義を作成できる
- `defineSchema()` 関数を追加: カラム定義マップから `NotionSchema<T>` を生成し、`notionAdapter` に渡すだけで TypeScript 型が自動推論される
- `default` オプション対応: 固定値または動的関数（`(page) => T`）を指定でき、Notion プロパティ未設定時のフォールバックとして使われる
- `default` 未指定は `T | null`、指定ありは `T`（`checkbox` / `multiSelect` は常に非 null）という厳密な型設計
- `notionAdapter` の `schema` オプションに `defineSchema()` の戻り値を渡せるようになった
- `publishedStatuses` / `accessibleStatuses` が `schema` の `select` 定義から自動抽出される

## core

- `DataSourceAdapter` インターフェースに `publishedStatuses?` / `accessibleStatuses?` を追加
- `CMS` コンストラクタで `source` が保持するフィルタ設定を `schema` 未指定時のフォールバックとして参照するようになった
