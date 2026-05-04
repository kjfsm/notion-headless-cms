# @notion-headless-cms/react-renderer

## 0.0.1

### Patch Changes

- aa3b1d5: `@notion-headless-cms/react-renderer` パッケージを新規追加。Notion API のブロックレスポンスを React コンポーネント (shadcn/ui + Tailwind v4) として直接描画する。`notion-to-md` を経由せず、Notion 全 block type に対応する。あわせて `@notion-headless-cms/notion-orm` に `fetchBlockTree(client, pageId)` を追加し、children を再帰的に解決済みのブロック木を返せるようにした。
