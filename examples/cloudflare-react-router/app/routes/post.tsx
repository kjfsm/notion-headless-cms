import {
  type NotionBlock,
  NotionRenderer,
} from "@notion-headless-cms/react-renderer";
import { NotionRevalidator } from "@notion-headless-cms/react-renderer/router";
import { resolveBlockImageUrls } from "@notion-headless-cms/react-renderer/server";
import { data } from "react-router";
import { makeCms } from "../lib/cms";
import type { Route } from "./+types/post";

export async function loader({ params, context }: Route.LoaderArgs) {
  try {
    const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
    const post = await cms.posts.find(params.slug ?? "");
    if (!post) throw data("Not Found", { status: 404 });
    const notionBlocks =
      ((await post.notionBlocks()) as NotionBlock[] | undefined) ?? [];
    const blocks = await resolveBlockImageUrls(notionBlocks, cms.cacheImage);
    return {
      blocks,
      item: {
        slug: post.slug,
        title: post.title,
        publishedAt: post.publishedAt,
        lastEditedTime: post.lastEditedTime,
      },
    };
  } catch (err) {
    console.error("[posts loader] エラー:", err);
    throw err;
  }
}

export default function Post({ loaderData }: Route.ComponentProps) {
  const { blocks, item } = loaderData;
  return (
    <article>
      <NotionRevalidator
        poll={{
          url: `/api/posts/${item.slug}/check`,
          version: item.lastEditedTime,
        }}
      />
      <h1>{item.title ?? item.slug}</h1>
      {item.publishedAt && <time>{item.publishedAt}</time>}
      <NotionRenderer blocks={blocks} />
    </article>
  );
}
