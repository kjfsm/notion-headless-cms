import {
  type NotionBlock,
  NotionRenderer,
} from "@notion-headless-cms/react-renderer";
import { NotionRevalidator } from "@notion-headless-cms/react-renderer/router";
import { resolveBlockImageUrls } from "@notion-headless-cms/react-renderer/server";
import { data } from "react-router";
import { makeCms } from "../../lib/cms";
import type { Route } from "./+types/$slug";

export async function loader({ params, context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  const doc = await cms.docs.find(params.slug ?? "");
  if (!doc) throw data("Not Found", { status: 404 });
  const notionBlocks =
    ((await doc.notionBlocks()) as NotionBlock[] | undefined) ?? [];
  const blocks = await resolveBlockImageUrls(notionBlocks, cms.cacheImage);
  return {
    blocks,
    item: {
      slug: doc.slug,
      title: doc.title,
      section: doc.section,
      description: doc.description,
      lastEditedTime: doc.lastEditedTime,
    },
  };
}

export default function Doc({ loaderData }: Route.ComponentProps) {
  const { blocks, item } = loaderData;
  return (
    <article>
      <NotionRevalidator
        poll={{
          url: `/api/docs/${item.slug}/check`,
          version: item.lastEditedTime,
        }}
      />
      <h1>{item.title ?? item.slug}</h1>
      {item.description && <p>{item.description}</p>}
      <NotionRenderer blocks={blocks} />
    </article>
  );
}
