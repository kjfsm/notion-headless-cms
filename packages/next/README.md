# @notion-headless-cms/next

Next.js App Router 向け notion-headless-cms メタパッケージ。  
`createCms`・画像プロキシ・Webhook ハンドラを一括提供します。

## インストール

```bash
pnpm add @notion-headless-cms/next @notion-headless-cms/react-renderer
pnpm add -D @notionhq/client zod
```

## 基本的な使い方

```ts
// lib/cms.ts
import { createCms } from "@notion-headless-cms/next";
import { notionSource } from "@notion-headless-cms/notion-source";
import { schema } from "./nhc-schema"; // nhc generate で生成

export const cms = createCms({
  sources: {
    notion: notionSource({ schema, token: process.env.NOTION_TOKEN! }),
  },
});
```

## next/image・next/link の注入

`NotionRenderer` の `Image` / `Link` プロップに Next.js のコンポーネントを渡すことで、
すべての画像とリンクが自動的に Next.js の最適化（自動 srcset・prefetch・layout shift 防止）を受けます。
個別のブロックを上書きする必要はありません。

```tsx
// app/posts/[slug]/page.tsx
import NextImage from "next/image";
import NextLink from "next/link";
import { NotionRenderer } from "@notion-headless-cms/react-renderer";
import { cms } from "@/lib/cms";

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await cms.notion.posts.find(slug);

  return (
    <article>
      <h1>{post.title}</h1>
      <NotionRenderer
        blocks={post.blocks}
        Image={(props) => (
          <NextImage
            {...props}
            src={props.src ?? ""}
            alt={props.alt ?? ""}
            width={800}
            height={600}
            style={{ width: "100%", height: "auto" }}
          />
        )}
        Link={(props) => <NextLink {...props} href={props.href ?? "#"} />}
        resolvePageUrl={(pageId) => `/posts/${pageId}`}
      />
    </article>
  );
}
```

### デフォルト動作との互換性

`Image` / `Link` を渡さない場合は素の `<img>` / `<a>` で描画されるため、
Next.js 以外の環境でもそのまま動作します。

## 画像プロキシ

Notion の画像 URL は約 1 時間で失効するため、プロキシ経由での配信を推奨します。

```ts
// app/api/notion-image/[...path]/route.ts
export { notionImageHandler as GET } from "@notion-headless-cms/next";
```

`resolveImageUrl` でプロキシ URL に書き換えることで、`next/image` との組み合わせも安全に動作します：

```tsx
<NotionRenderer
  blocks={post.blocks}
  resolveImageUrl={(url) =>
    `/api/notion-image/${Buffer.from(url).toString("base64url")}`
  }
  Image={(props) => (
    <NextImage {...props} src={props.src ?? ""} alt={props.alt ?? ""} fill />
  )}
/>
```
