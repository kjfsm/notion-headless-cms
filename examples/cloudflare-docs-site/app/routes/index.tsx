import { NotionRevalidator } from "@notion-headless-cms/react-renderer/router";
import { redirect } from "react-router";
import { makeCms } from "../lib/cms";
import type { Route } from "./+types/index";

export async function loader({ context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  const page = await cms.pages.find("home");
  if (!page) return redirect("/docs");
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

export default function Index({ loaderData }: Route.ComponentProps) {
  const { html, item } = loaderData;
  return (
    <main>
      <NotionRevalidator
        poll={{
          url: `/api/pages/${item.slug}/check`,
          version: item.lastEditedTime,
        }}
      />
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: cms renderer の出力を信頼する */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
