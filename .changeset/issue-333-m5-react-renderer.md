---
"@notion-headless-cms/react-renderer": patch
---

M5: React renderer のテーマ Provider とレスポンシブ画像対応 (Issue #333)

- `<NotionThemeProvider theme="light" | "dark" | "system">` を新規追加
  - ルート div に `dark` クラス (カスタマイズ可) を付与し、Tailwind v4 の dark mode と組み合わせて使える
  - `theme="system"` は `prefers-color-scheme` を hydration 後に追従する (SSR は light 扱い)
- `<NotionRenderer imageSizes={[400, 800, 1200]} imageSizesAttr="...">` を追加
  - `Image` ブロックが `resolveImageUrl` で proxy URL に書き換えられている場合のみ `?w={width}` 付きの `srcSet` を生成する
  - 画像プロキシ側で派生キーをサポートしている前提 (`buildCacheImageFn` の拡張は後続タスク)
  - Notion 署名済み URL (失効する) には `srcSet` を出さない安全動作
- Context 値に `imageSizes` / `imageSizesAttr` を追加
