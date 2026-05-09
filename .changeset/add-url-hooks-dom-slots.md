---
"@notion-headless-cms/react-renderer": patch
---

react-renderer: resolveImageUrl / resolvePageUrl / Image / Link スロットを追加 (#218 / #219)

- `NotionRenderer` props に `resolveImageUrl` / `resolvePageUrl` を追加。Context 経由で Image・Video・Audio・File・Pdf・LinkToPage・ChildPage ブロック全体に伝播する
- `Image` / `Link` コンポーネントスロットを追加。`next/image` / `next/link` などのフレームワーク最適化コンポーネントをブロック override なしに差し込める
- `OgCard` の `<a>` / `<img>` も同スロットに対応
- 未注入時は従来通り `<img>` / `<a>` にフォールバックし、完全互換
