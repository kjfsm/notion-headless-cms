---
"@notion-headless-cms/notion-katex": patch
"@notion-headless-cms/notion-orm": patch
"@notion-headless-cms/react-renderer": patch
---

notion-katex: フェッチ時に数式を KaTeX HTML へ事前変換するパッケージを追加（#221）

- `@notion-headless-cms/notion-katex` を新設。`notionKatex()` が `BlockEnricher` を返す
- `notion-orm`: `BlockEnricher` 型と `enrichers` オプションを `NotionCollectionCommonOptions` に追加
- `react-renderer`: `Equation` コンポーネントが `__cachedHtml` を `dangerouslySetInnerHTML` で描画。Workers バンドルから katex を除外できる
