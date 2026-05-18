import { Renderer } from "@notion-headless-cms/fetch-markdown/react";
import { NotionRevalidator } from "@notion-headless-cms/react-renderer/router";
import { redirect } from "react-router";
import { makeCms } from "../lib/cms";
import type { Route } from "./+types/index";

export async function loader({ context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  const page = await cms.pages.find("home");
  if (!page) return redirect("/docs");
  const markdown = await page.markdown();
  return {
    markdown,
    item: {
      slug: page.slug,
      title: page.title,
      lastEditedTime: page.lastEditedTime,
    },
  };
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const { markdown, item } = loaderData;
  return (
    <main>
      <NotionRevalidator
        poll={{
          url: `/api/pages/${item.slug}/check`,
          version: item.lastEditedTime,
        }}
      />
      <Renderer content={{ markdown }} />
    </main>
  );
}
