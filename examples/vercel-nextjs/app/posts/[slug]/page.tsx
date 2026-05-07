import {
  type BlockComponentProps,
  type NotionBlock,
  NotionRenderer,
} from "@notion-headless-cms/react-renderer";
// Equation は "use client" を含むため Server Component (page.tsx) から直接 import し、
// Next.js の client reference として `<NotionRenderer components={{ Equation }} />`
// に渡す。next/dynamic で包むと RSC のシリアライズ境界で
// "Functions cannot be passed to Client Components" エラーが発生するため避ける。
// 直接 import でもルート単位で自動コードスプリットされるため、katex は post ページの
// チャンクにだけ含まれる。
import { Equation as KatexEquation } from "@notion-headless-cms/react-renderer/equation";
import { resolveBlockImageUrls } from "@notion-headless-cms/react-renderer/server";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import { cms } from "@/app/lib/cms";

// ComponentOverrides は broad な BlockObjectResponse 型を取るため、narrow な
// `EquationBlockObjectResponse` を受ける KatexEquation はキャストして渡す。
// （DX 改善は kjfsm/notion-headless-cms#217 で追跡）
const Equation = KatexEquation as unknown as ComponentType<BlockComponentProps>;

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    return (await cms.posts.params()).map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await cms.posts.find(slug);
  if (!post) notFound();

  // notionBlocks() は cms キャッシュ (SWR) 経由で取得されるため、
  // ページごとに毎回 Notion API を叩かない。画像 URL は cms.cacheImage で
  // プロキシ URL へ事前解決し、Notion 署名 URL の期限切れを回避する。
  const notionBlocks =
    ((await post.notionBlocks()) as NotionBlock[] | undefined) ?? [];
  const blocks = await resolveBlockImageUrls(notionBlocks, cms.cacheImage);

  return (
    <article className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-4">{post.slug}</h1>
      {post.publishedAt && (
        <time className="block text-sm text-gray-500 mb-8">
          {post.publishedAt}
        </time>
      )}
      <NotionRenderer blocks={blocks} components={{ Equation }} />
    </article>
  );
}
