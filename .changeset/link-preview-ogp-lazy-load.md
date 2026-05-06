---
"@notion-headless-cms/notion-embed": patch
"@notion-headless-cms/react-renderer": patch
"@notion-headless-cms/notion-orm": patch
---

link_preview ブロックに OGP カード表示を追加

- `fetchBlockTree` の OGP enrichment 対象に `link_preview` を追加（`LinkPreviewBlockWithOgp` 型を export）
- `renderLinkPreview` が OGP 取得に対応。成功時は bookmark と同形状のカードを出力、失敗時はシンプルリンクにフォールバック。OG 画像は `loading="lazy"` でブラウザ側取得（ミラーリングなし）
- `LinkPreview` React コンポーネントが `ogp` フィールドを持つ場合に `OgCard` を使用
