---
title: レンダラの選択
description: cms/html と react-renderer の使い分け
category: ガイド
order: 4
---

# レンダラの選択

`@notion-headless-cms/cms` の `find()` が返す `entry.blocks` は、同期時に画像 URL・内部リンクが
解決済みのプレーンな `NormalizedBlock[]`。これをどう画面に出すかで、現行アーキテクチャでは
2 つの選択肢がある（v2 にあった `markdown-html`/`block-html`/`notion-source` 経由の Markdown
変換は廃止された。v3 は Notion の block ツリーを直接レンダリングする）。

## 選択フロー

```
React を使う?
├─ はい → @notion-headless-cms/react-renderer
└─ いいえ（Hono の JSON API・RSS・メール本文など）
    └─ @notion-headless-cms/cms の `./html` サブパス（renderBlocksToHtml）
```

---

## `@notion-headless-cms/cms/html`

`cms` 本体に同梱された、React 不要の HTML レンダラ。追加インストール不要（`cms` を入れていれば
すぐ使える）。

```ts
import { renderBlocksToHtml } from "@notion-headless-cms/cms/html";

const post = await cms.posts.find(slug);
if (post) {
  const html = renderBlocksToHtml(post.blocks, { links: post.links });
}
```

bookmark / embed / link_preview は OGP 情報を持たない素の「シェル」（リンクカードの骨格）を
返す（OGP メタデータの取得は行わない）。YouTube 等の embed は許可ホスト（`allowedEmbedHosts`）
を明示した場合のみ iframe 直埋め込みになり、それ以外はシェルにフォールバックする。

**適した用途**:
- Hono/Express などの JSON API・RSS フィード・メール本文
- React を使わないシンプルな SSR
- バンドルサイズを絞りたい場合

---

## `@notion-headless-cms/react-renderer`

`NormalizedBlock[]` を `denormalizeBlocks()` で `BlockObjectResponse` 形状に変換し、React
コンポーネントとして描画する。UI プリミティブは shadcn/ui（`new-york` style）、スタイルは
Tailwind v4 ユーティリティクラスで完結する。

```bash
pnpm add @notion-headless-cms/react-renderer
# peer deps（利用側フレームワークに応じて）
pnpm add react react-dom
```

利用側で Tailwind v4 のエントリ CSS に既定テーマを読み込む必要がある。

```css
/* app.css など */
@import "tailwindcss";
@import "@notion-headless-cms/react-renderer/theme.css";
```

```tsx
import { NotionRenderer } from "@notion-headless-cms/react-renderer";
import { denormalizeBlocks, toPageLinkMap } from "@notion-headless-cms/react-renderer/cms";

const post = await cms.posts.find(slug);
if (!post) return null;

export default function Page() {
  return (
    <NotionRenderer
      blocks={denormalizeBlocks(post.blocks)}
      pageLinks={toPageLinkMap(post.links)}
      ogpEndpoint="/api/cms/ogp" // bookmark/embed/link_preview の OGP カードを有効化
    />
  );
}
```

bookmark / embed / link_preview の OGP カードはクライアント側フェッチ方式。`ogpEndpoint` を
渡すと `cms.fetch()` がマウントする `GET {routes}/ogp` をページアクセス時に叩いて描画する
（渡さなければシェルのまま）。

フレームワーク別の統合ヘルパー（`useNotionRevalidate`/`NotionRevalidator`）は React Router
向け `/router`、Next.js App Router 向け `/next` のサブパスにある
（詳細は [`recipes/react-router.md`](./recipes/react-router.md) /
[`recipes/nextjs-app-router.md`](./recipes/nextjs-app-router.md)）。数式（KaTeX）は
`transforms`（`createKatexTransform()`、同期時に事前レンダー）と組み合わせるか、
利用側で `katex/dist/katex.min.css` を読み込む。

**適した用途**:
- Next.js / React Router など React ベースのフレームワーク
- Notion のブロック構造をそのまま React で制御したい
- shadcn/ui のデザインシステムと統合したい

---

## まとめ

| | `cms/html` | `react-renderer` |
|---|:---:|:---:|
| React 不要 | ✅ | ❌ |
| 追加インストール | 不要（`cms` に同梱） | 必要 |
| OGP カード（bookmark/embed/link_preview） | シェルのみ（OGP 取得なし） | ✅（`ogpEndpoint` 指定時、クライアント側フェッチ） |
| shadcn/ui コンポーネント | ❌ | ✅ |
| SSR / Workers 対応 | ✅ | ✅（RSC 可） |
| バンドルサイズ（目安） | 小 | 中〜大 |

両者は排他的ではない。React アプリで `react-renderer` を使い、同じデータから RSS フィードや
メール本文だけ `cms/html` の `renderBlocksToHtml()` で組み立てる、という組み合わせも可能。

## 関連ドキュメント

- [CMS メソッド一覧](./api/cms-methods.md)
- [React Router レシピ](./recipes/react-router.md)
- [Cloudflare Workers レシピ](./recipes/cloudflare-workers.md)
