---
"@notion-headless-cms/cli": patch
---

Notion `select` 型プロパティの生成型を `string | null` に変更

これまで Notion の `select` / `status` 型は両方ともリテラル union（例: `"Alice" | null`）を生成していた。
`select` 型はユーザーが Notion UI から自由に選択肢を追加できるため、新しい選択肢が追加されるたびに
`nhc generate` の再実行が必要になる問題があった。

- `status` 型（ワークフロー状態）→ 引き続きリテラル union（例: `"下書き" | "公開済み" | null`）
- `select` 型（著者・カテゴリ等）→ `string | null` に変更
