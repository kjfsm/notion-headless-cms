---
"@notion-headless-cms/core": patch
"@notion-headless-cms/notion-orm": patch
"@notion-headless-cms/notion-source": patch
"@notion-headless-cms/client": patch
"@notion-headless-cms/validate": patch
"@notion-headless-cms/cli": patch
---

要素（データ）コレクション `kind: "data"` を追加

URL ルーティングしない単純なデータ（設定値一覧・選択肢リストなど）を、ページとは別概念のコレクションとして扱えるようにした。`nhc.config.ts` のコレクションに `kind: "data"` を指定すると、slug を持たない `list()` / `get(id)` / `cache.invalidate()` のみのクライアントになり、Notion DB に URL 用の slug プロパティを用意する必要がなくなる。

- ページコレクション（既定 `kind: "page"`）は従来どおり `find(slug)` / `params()` / 本文レンダリングを持つ。
- 要素コレクションのアイテム型からは `slug` が除去され、`find` / `params` の呼び出しはコンパイルエラーになる。
- 内部 identity は `slug ?? id` に統一。既存ページのキャッシュキーは slug のまま不変（キャッシュ移行なし）。`BaseContentItem.slug` は optional 化したが、ページコレクションのアイテム型は従来どおり `slug: string`。
- 以前は slug を持たないコレクションで `cms.xxx.list()` が「Notion ページのスラグが空です」で落ちていた問題を解消。
