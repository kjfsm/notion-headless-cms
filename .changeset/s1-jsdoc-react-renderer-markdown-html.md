---
"@notion-headless-cms/react-renderer": patch
"@notion-headless-cms/markdown-html": patch
---

公開 API の JSDoc に `@example` と `@see` を追加し、IDE ホバーで使い方と関連 API へジャンプできるようにした (Issue #305 / S1)。`NotionRenderer` / `NotionBlocks` / `BlockSwitch` / `useNotionContext` / `resolveBlockImageUrls` / `RichText` / `Caption` / `renderMarkdown` / `Transformer` / `createTransformer` / `BlockHandler` / `RendererFn` / `RendererOptions` / `BlockConverter` / `rehypeImageCache` が対象。
