import {
  type NotionBlock,
  NotionRenderer,
} from "@notion-headless-cms/react-renderer";
import { NotionRevalidator } from "@notion-headless-cms/react-renderer/router";
import { resolveBlockImageUrls } from "@notion-headless-cms/react-renderer/server";
import { redirect } from "react-router";
import { makeCms } from "../lib/cms";
import type { Route } from "./+types/index";

export async function loader({ context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  const page = await cms.pages.find("home");
  if (!page) return redirect("/docs");
  const notionBlocks =
    ((await page.notionBlocks()) as NotionBlock[] | undefined) ?? [];
  const blocks = await resolveBlockImageUrls(notionBlocks, cms.cacheImage);
  return {
    blocks,
    item: {
      slug: page.slug,
      title: page.title,
      lastEditedTime: page.lastEditedTime,
    },
  };
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const { blocks, item } = loaderData;
  return (
    <main>
      <NotionRevalidator
        poll={{
          url: `/api/pages/${item.slug}/check`,
          version: item.lastEditedTime,
        }}
      />
      <NotionRenderer blocks={blocks} />
    </main>
  );
}
