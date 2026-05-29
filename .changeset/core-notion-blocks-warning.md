---
"@notion-headless-cms/core": patch
---

`notionBlocks()` がブロックフェッチャ未設定などで `undefined` を返したとき、`notionSource({ fetch: blocksFetcher() })` の設定を促す警告を CollectionClient 単位で一度だけ出すようにした。無言失敗で React レンダリングが空になる問題の発見性を改善する。返り値・公開 API シグネチャは変更なし（挙動互換）。
