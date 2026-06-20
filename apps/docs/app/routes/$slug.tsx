import { isReloadRequest } from "@notion-headless-cms/client";
import { NotionRevalidator, Renderer } from "@notion-headless-cms/client/react";
import { data } from "react-router";
import { makeCms } from "../lib/cms";
import type { Route } from "./+types/$slug";

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  // 明示リロード（F5）時は recheck ウィンドウを無視して Notion を再取得する。
  const page = await cms.pages.find(params.slug ?? "", {
    force: isReloadRequest(request),
  });
  if (!page) throw data("Not Found", { status: 404 });
  const blocks = await page.notionBlocks();
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
    <main className="mx-auto max-w-3xl px-6 py-16 animate-fade-in-up">
      <NotionRevalidator
        poll={{
          url: `/api/pages/${item.slug}/check`,
          version: item.lastEditedTime,
        }}
      />
      <header className="mb-10">
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-gray-900">
          {item.title ?? item.slug}
        </h1>
        {item.description && (
          <p className="mt-3 text-gray-500 leading-relaxed">
            {item.description}
          </p>
        )}
      </header>
      <article className="prose prose-neutral max-w-none prose-headings:tracking-tighter prose-headings:font-bold prose-a:text-purple-600 prose-a:no-underline hover:prose-a:underline prose-code:text-purple-600">
        <Renderer blocks={blocks} />
      </article>
    </main>
  );
}
