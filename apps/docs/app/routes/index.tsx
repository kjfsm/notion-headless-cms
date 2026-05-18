import { Renderer } from "@notion-headless-cms/fetch-blocks/react";
import type { NotionBlock } from "@notion-headless-cms/react-renderer";
import { NotionRevalidator } from "@notion-headless-cms/react-renderer/router";
import { redirect } from "react-router";
import { makeCms } from "../lib/cms";
import type { Route } from "./+types/index";

export async function loader({ context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  const page = await cms.pages.find("home");
  if (!page) return redirect("/docs");
  // fetch-blocks 戦略で Notion BlockObjectResponse ツリーを取得し、
  // react-renderer の <Renderer> で callout / column / embed を React コンポーネントに展開する。
  const blocks = ((await page.notionBlocks()) ?? []) as NotionBlock[];
  return {
    blocks,
    item: {
      slug: page.slug,
      title: page.title,
      lastEditedTime: page.lastEditedTime,
    },
  };
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  return [
    {
      title: loaderData?.item.title
        ? `${loaderData.item.title} | notion-headless-cms`
        : "notion-headless-cms",
    },
  ];
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const { blocks, item } = loaderData;
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 animate-fade-in-up">
      <NotionRevalidator
        poll={{
          url: `/api/pages/${item.slug}/check`,
          version: item.lastEditedTime,
        }}
      />
      <article className="prose prose-neutral max-w-none dark:prose-invert">
        <Renderer blocks={blocks} />
      </article>
    </main>
  );
}
