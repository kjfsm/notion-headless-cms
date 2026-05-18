import { Renderer } from "@notion-headless-cms/fetch-blocks/react";
import type { NotionBlock } from "@notion-headless-cms/react-renderer";
import { NotionRevalidator } from "@notion-headless-cms/react-renderer/router";
import { data } from "react-router";
import { makeCms } from "../lib/cms";
import type { Route } from "./+types/$slug";

export async function loader({ params, context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  const page = await cms.pages.find(params.slug ?? "");
  if (!page) throw data("Not Found", { status: 404 });
  const blocks = ((await page.notionBlocks()) ?? []) as NotionBlock[];
  return {
    blocks,
    item: {
      slug: page.slug,
      title: page.title,
      description: page.description,
      lastEditedTime: page.lastEditedTime,
    },
  };
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not Found" }];
  return [
    {
      title: `${loaderData.item.title ?? loaderData.item.slug} | notion-headless-cms`,
    },
    ...(loaderData.item.description
      ? [{ name: "description", content: loaderData.item.description }]
      : []),
  ];
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const { blocks, item } = loaderData;
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 animate-fade-in-up">
      <NotionRevalidator
        poll={{
          url: `/api/pages/${item.slug}/check`,
          version: item.lastEditedTime,
        }}
      />
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          {item.title ?? item.slug}
        </h1>
        {item.description && (
          <p className="mt-2 text-muted-foreground">{item.description}</p>
        )}
      </header>
      <article className="prose prose-neutral max-w-none dark:prose-invert">
        <Renderer blocks={blocks} />
      </article>
    </main>
  );
}
