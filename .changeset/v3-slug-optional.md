---
"@notion-headless-cms/cms": patch
---

`defineCollection` の `slug` を任意にした。slug 列を持たない設定値コレクション（選択肢リスト・埋め込み情報など）を、種別（`kind`）を増やさずに定義できる。

- `slug` を省略したコレクションは、エントリを Notion の page id でアドレスする（`find(pageId)` で取得、`list()` は全件を返す）。どのプロパティも slug に流用しないため、タイトル等への暗黙の一意性要求が発生しない
- `slug` を指定したコレクションで値が空のページは従来どおり `CMSError(sync/slug_missing)` を投げる（壊れた URL を防ぐ設定ミス検知）
- 内部の sync → store → index → find → list は slug 有無で分岐せず単一経路のまま。slug 未設定コレクションは内部リンク解決用 `PageIndex` からは除外する（URL ルーティングしないため）
