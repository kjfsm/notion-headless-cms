---
"@notion-headless-cms/cli": patch
---

コード生成時の `status` / `publishedAt` フォールバック型を `string | null` に修正。

DB に `status` / `publishedAt` プロパティが存在しないコレクションでは、`BaseContentItem` の定義（`string | null`）と一致させるためフォールバックフィールドを `string | null` で生成するよう変更した。従来の `string`（null 非許容）では `CMSItemFromSchema` の推論型との不一致で型エラーが発生していた。
