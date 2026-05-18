---
title: レンダラの選択
description: markdown-html / block-html / react-renderer の使い分け
category: ガイド
order: 4
---

# レンダラの選択

notion-headless-cms には 3 種類のレンダラがあります。用途に応じて選んでください。

## 選択フロー

```
React を使う?
├─ はい → @notion-headless-cms/react-renderer
└─ いいえ
    ├─ bookmark / embed / YouTube カードが必要?
    │   └─ はい → @notion-headless-cms/block-html
    └─ いいえ (シンプルな Markdown → HTML だけ)
        └─ @notion-headless-cms/markdown-html (デフォルト)
```

---

## @notion-headless-cms/markdown-html

**Markdown → HTML** に変換する基本レンダラ。remark / rehype ベース。

`createClient` でレンダラを指定しない場合はこれが自動で使われます。

```bash
pnpm add @notion-headless-cms/markdown-html
# peer deps
pnpm add unified remark-parse remark-gfm remark-rehype rehype-stringify
```

```ts
import { renderMarkdown } from "@notion-headless-cms/markdown-html";

// createClient に渡す場合
const cms = createClient({
  sources: { ... },
  renderer: renderMarkdown,
  ...nodePreset(),
});
```

**適した用途**:
- ブログ記事などシンプルなテキストコンテンツ
- Notion の標準ブロック（段落・見出し・リスト・コード等）を表示するだけ

---

## @notion-headless-cms/block-html

`markdown-html` を拡張し、Notion 固有のリッチブロックを HTML で描画します。

追加で対応するブロック: `bookmark`, `embed`, `link_preview`, `mention`, `callout`, `toggle`, `table`, YouTube カード など。

```bash
pnpm add @notion-headless-cms/block-html
# peer deps
pnpm add @notion-headless-cms/markdown-html hast-util-sanitize rehype-raw rehype-sanitize
```

```ts
import { notionEmbed, youtubeProvider } from "@notion-headless-cms/block-html";

const embed = notionEmbed({
  providers: [youtubeProvider({ display: "card" })],
});

const cms = createClient({
  sources: {
    notion: notionSource({
      schema,
      token: process.env.NOTION_TOKEN!,
      blocks: embed.blocks, // カスタムブロックハンドラを渡す
    }),
  },
  renderer: embed.renderer,
  ...nodePreset(),
});
```

**適した用途**:
- YouTube 埋め込み・bookmark カード・OGP 表示が必要なブログ
- Notion のリッチコンテンツをそのまま HTML で出力したい

---

## @notion-headless-cms/react-renderer

`BlockObjectResponse`（Notion API の生レスポンス）を React コンポーネントに直接変換します。shadcn/ui + Tailwind v4 ベース。

```bash
pnpm add @notion-headless-cms/react-renderer
# peer deps
pnpm add react react-dom
```

```tsx
import { NotionRenderer } from "@notion-headless-cms/react-renderer";

export function PostPage({ blocks }) {
  return <NotionRenderer blocks={blocks} />;
}
```

**適した用途**:
- Next.js / Remix / React Router など React ベースのフレームワーク
- Notion のブロック構造をそのまま React で制御したい
- shadcn/ui のデザインシステムと統合したい

> **注意**: このパッケージは HTML レンダラ（markdown-html / block-html）と排他的ではありません。React アプリで `react-renderer` を使い、RSS フィードやメール本文では `markdown-html` を使う、という組み合わせも可能です。

---

## まとめ

| | markdown-html | block-html | react-renderer |
|---|:---:|:---:|:---:|
| React 不要 | ✅ | ✅ | ❌ |
| YouTube / bookmark カード | ❌ | ✅ | ✅ |
| shadcn/ui コンポーネント | ❌ | ❌ | ✅ |
| SSR / Workers 対応 | ✅ | ✅ | ✅ (RSC 可) |
| バンドルサイズ（目安） | 小 | 中 | 大 |
