import { NotionRenderer } from "@notion-headless-cms/react-renderer";
import { denormalizeBlocks, toPageLinkMap } from "@notion-headless-cms/react-renderer/cms";
import { NotionRevalidator } from "@notion-headless-cms/react-renderer/router";
import { data } from "react-router";

import { makeCms } from "../lib/cms";
import { remapPageLinks } from "../lib/cms-helpers";
import type { Route } from "./+types/$slug";

export async function loader({ params, context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  const entry = await cms.pages.find(params.slug ?? "");
  if (!entry) throw data("Not Found", { status: 404 });
  const blocks = denormalizeBlocks(entry.blocks);
  const pageLinks = remapPageLinks(toPageLinkMap(entry.links));
  return {
    blocks,
    pageLinks,
    item: entry.meta,
  };
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not Found" }];
  return [
    {
      title: `${loaderData.item.name ?? loaderData.item.slug} | notion-headless-cms`,
    },
    ...(loaderData.item.description
      ? [{ name: "description", content: loaderData.item.description }]
      : []),
  ];
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const { blocks, pageLinks, item } = loaderData;
  return (
    <main className="mx-auto max-w-3xl animate-fade-in-up px-6 py-16">
      <NotionRevalidator on={["mount", "visibility"]} />
      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tighter text-gray-900 md:text-5xl">
          {item.name ?? item.slug}
        </h1>
        {item.description && (
          <p className="mt-3 leading-relaxed text-gray-500">{item.description}</p>
        )}
      </header>
      <article className="prose max-w-none prose-neutral prose-headings:font-bold prose-headings:tracking-tighter prose-a:text-purple-600 prose-a:no-underline hover:prose-a:underline prose-code:text-purple-600">
        <NotionRenderer blocks={blocks} pageLinks={pageLinks} />
      </article>
    </main>
  );
}
