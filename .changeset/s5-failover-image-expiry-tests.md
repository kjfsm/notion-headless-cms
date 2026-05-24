---
"@notion-headless-cms/core": patch
---

マルチソース構成のフェイルオーバー (1 つのコレクションが失敗しても他が独立に動く) と、画像キャッシュが Notion 署名 URL の 1 時間失効後も SHA256 ハッシュキーで永続キャッシュから返すことを fakeTimers で明示検証するテストを追加 (Issue #309 / S5)。
