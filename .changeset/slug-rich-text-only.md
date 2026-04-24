---
"@notion-headless-cms/cli": patch
"@notion-headless-cms/notion-orm": patch
---

fix: slug を rich_text 専用にマッピング変更

- `queryPageBySlug` のフィルタを常に `rich_text` 型に統一（`title` 型フィルタを廃止）
- `nhc generate` の slug 自動検出を `rich_text` 型プロパティ（"slug"/"Slug"/"スラッグ"）専用に変更
- DB に対象の `rich_text` プロパティが存在しない場合、generate がエラーで失敗するように変更
