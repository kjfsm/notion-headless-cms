---
"@notion-headless-cms/core": patch
"@notion-headless-cms/notion-source": patch
"@notion-headless-cms/cli": patch
---

コレクションから Notion DB の表示名を参照できる `cms.<collection>.dbName` を追加。`nhc generate` が introspect 時に取得した DB 名を schema に埋め込み、ページ・要素（`kind: "data"`）の両コレクションで参照できる。手書き schema で `dbName` を省略した場合は `undefined`。
