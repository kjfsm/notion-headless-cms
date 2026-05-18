import { NotionRevalidator } from "@notion-headless-cms/react-renderer/router";
import { data } from "react-router";
import { makeCms } from "../lib/cms";
import type { Route } from "./+types/$slug";

export async function loader({ params, context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  const page = await cms.pages.find(params.slug ?? "");
  if (!page) throw data("Not Found", { status: 404 });
  // markdownFetcher 戦略のため、cms.ts の renderer を通った HTML を直接使う。
  const html = await page.html();
  return {
    html,
    item: {
      slug: page.slug,
      title: page.title,
      lastEditedTime: page.lastEditedTime,
    },
  };
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const { html, item } = loaderData;
  return (
    <main>
      <NotionRevalidator
        poll={{
          url: `/api/pages/${item.slug}/check`,
          version: item.lastEditedTime,
        }}
      />
      <h1>{item.title ?? item.slug}</h1>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: cms renderer の出力を信頼する */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
