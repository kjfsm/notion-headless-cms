---
"@notion-headless-cms/notion-shiki": patch
"@notion-headless-cms/react-renderer": patch
---

feat(#220): notion-shiki パッケージと react-renderer/code サブパス export を追加

- `@notion-headless-cms/notion-shiki` 新規パッケージ: fetch 時に shiki で code ブロックを pre-render し `block.code.__cachedHtml` へ埋め込む `BlockEnricher` を提供。Workers バンドルから shiki を除外できる（`notion-katex` の Code 版）
- `react-renderer` の `Code` スタブを更新: `__cachedHtml` が付与されていれば `dangerouslySetInnerHTML` で描画、なければ従来の `<pre>` にフォールバック（完全後方互換）
- `react-renderer/code` サブパスを追加: `shiki` をブラウザで直接使いたい場合に `SyntaxHighlighter` を import できる（`createHighlighter` + React 19 `use()` + Suspense で非同期初期化を吸収）
