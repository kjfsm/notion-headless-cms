---
"@notion-headless-cms/notion-embed": patch
---

Steam・Vimeo・DLsite の組み込み provider を削除し、embed ブロックの汎用フォールバックに OGP カード表示を追加

- `steamProvider` / `vimeoProvider` / `dlsiteProvider` を削除（破壊的変更）
- provider にマッチしない embed ブロックは OGP を取得してブックマーク風カードを表示し、OGP が取得できない場合のみ汎用 iframe にフォールバックする
- `renderEmbed` に `ogpOptions` 引数を追加。`false` を渡すと OGP 取得をスキップして即 iframe を出力する
