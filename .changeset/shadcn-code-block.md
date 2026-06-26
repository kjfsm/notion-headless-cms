---
"@notion-headless-cms/notion-shiki": patch
"@notion-headless-cms/react-renderer": patch
---

コードブロック・callout を shadcn ドキュメント風に寄せる。

- `notion-shiki`: シンタックスハイライトを `@shikijs/rehype` から `rehype-pretty-code`
  へ移行し、既定をライト/ダークのデュアルテーマ化。表示前にサーバーで code ブロックを
  事前ハイライトして `block.code.__cachedHtml` に埋める `highlightCodeBlocks()` を追加
  （`content: "react"` 経路向け。`resolveBlockImageUrls` と同じ前処理パターン）。
- `react-renderer`: `Code` を shadcn docs 風の枠（ヘッダー: ファイル名 + 言語ラベル +
  コピーボタン、本体: 行番号付きハイライト、長いコードは折りたたみ）へ刷新。公式の
  `copy-button` / `callout` / `code-collapsible-wrapper` を移植し、Notion の callout
  ブロックを公式 `Callout` でラップ。`theme.css` にデュアルテーマ切替・行番号の CSS と
  `--surface` / `--code` トークンを追加。
