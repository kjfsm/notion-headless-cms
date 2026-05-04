import { fetchBlockTree } from "@notion-headless-cms/notion-orm";
import { NotionRenderer } from "@notion-headless-cms/react-renderer";
import { Client } from "@notionhq/client";
import { data } from "react-router";
import { makeCms } from "../lib/cms";
import type { Route } from "./+types/post";

export async function loader({ params, context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env);
  const post = await cms.posts.find(params.slug ?? "");
  if (!post) throw data("Not Found", { status: 404 });
  // react-renderer は Notion API のブロック木を直接消費する。
  // 既存の post.html() ではなく fetchBlockTree でツリーを取り、React で描画する。
  const client = new Client({ auth: context.cloudflare.env.NOTION_TOKEN });
  const blocks = await fetchBlockTree(client, post.id);
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
