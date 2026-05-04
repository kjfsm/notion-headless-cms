import {
  type NotionBlock,
  NotionRenderer,
} from "@notion-headless-cms/react-renderer";
import { resolveBlockImageUrls } from "@notion-headless-cms/react-renderer/server";
import { data } from "react-router";
import { makeCms } from "../lib/cms";
import type { Route } from "./+types/post";

export async function loader({ params, context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env);
  const post = await cms.posts.find(params.slug ?? "");
  if (!post) throw data("Not Found", { status: 404 });
  // notionBlocks() は cms (R2 + KV) キャッシュ経由で取得され、
  // 画像 URL は cms.cacheImage で R2 プロキシへ事前解決される。
  const notionBlocks =
    ((await post.notionBlocks()) as NotionBlock[] | undefined) ?? [];
  const blocks = await resolveBlockImageUrls(notionBlocks, cms.cacheImage);
  return { blocks, item: post };
}

export default function Post({ loaderData }: Route.ComponentProps) {
  const { blocks, item } = loaderData;
  return (
    <article>
      <h1>{item.slug}</h1>
      {item.publishedAt && <time>{item.publishedAt}</time>}
      <NotionRenderer blocks={blocks} />
    </article>
  );
}
