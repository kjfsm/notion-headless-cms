---
"@notion-headless-cms/notion-orm": patch
---

`createNotionCollection` に `ogp` オプションを追加し、ブックマーク/埋め込みブロックの OGP 取得を有効化できるようにした。これにより `react-renderer` の `OgCard` で外部サイトの OG 画像が表示されるようになる。
