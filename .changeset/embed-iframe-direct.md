---
"@notion-headless-cms/notion-embed": patch
---

embed ブロックを OGP カードではなく iframe で直接表示するように変更

- provider にマッチしない embed ブロックは OGP を取得せず、直接 `<iframe>` を出力する
- OGP カードは bookmark ブロック専用の挙動として分離
- `renderEmbed` から `ogpOptions` 引数を削除
