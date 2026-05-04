---
"@notion-headless-cms/notion-embed": patch
"@notion-headless-cms/renderer": patch
---

リンク崩れ・レンダリングバグを修正

- `nhc-inline-code` クラスが rehype-sanitize で除去されるバグを修正（`code: ["className"]` を sanitize スキーマに追加）
- toggle ブロックが出力に現れないバグを修正（notion-to-md v3 のカスタムトランスフォーマーが children 取得をスキップする問題を NtmConverter で補完）
- toggle の `<details>` に `nhc-toggle` / `nhc-toggle__summary` CSS クラスを付与する rehype プラグインを追加
- `link_to_page` ブロックのハンドラーを実装（`nhc-link-to-page` クラス、`resolvePageTitle` 対応）
- `link_preview` / `link_to_page` / `audio` ブロックが remark に `<p>` でラップされるレイアウト崩れを修正（`<div>` ブロックラッパーを追加）
