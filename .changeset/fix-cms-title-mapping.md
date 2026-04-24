---
"@notion-headless-cms/notion-orm": patch
---

`defineSchema` 経由で `title` が取得できないバグと `queryPageBySlug` の `title` 型フィルタ未対応を修正

- `parseMapping` に title 自動セット処理を追加（`mapItem` と同様に Notion ページタイトルを自動マッピング）
- `queryPageBySlug` が slug フィールドの型に応じて `title` / `rich_text` フィルタを使い分けるよう修正
