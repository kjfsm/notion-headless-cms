import { Renderer } from "@notion-headless-cms/fetch-markdown/react";
import { NotionRevalidator } from "@notion-headless-cms/react-renderer/router";
import { data } from "react-router";
import { makeCms } from "../../lib/cms";
import type { Route } from "./+types/$slug";

export async function loader({ params, context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  const doc = await cms.docs.find(params.slug ?? "");
  if (!doc) throw data("Not Found", { status: 404 });
  // markdownFetcher 戦略で取得した markdown を loader が返し、
  // ページ側で <Renderer> が React 木に変換する。
  const markdown = await doc.markdown();
  return {
    markdown,
    item: {
      slug: doc.slug,
      title: doc.title ?? doc.name,
      section: doc.section,
      description: doc.description,
      lastEditedTime: doc.lastEditedTime,
    },
  };
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  return [{ title: loaderData?.item.title ?? "ドキュメント" }];
}

export default function Doc({ loaderData }: Route.ComponentProps) {
  const { markdown, item } = loaderData;
  return (
    <article>
      <NotionRevalidator
        poll={{
          url: `/api/docs/${item.slug}/check`,
          version: item.lastEditedTime,
        }}
      />
      <header className="mb-8">
        {item.section && (
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
            {item.section}
          </p>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">
          {item.title ?? item.slug}
        </h1>
        {item.description && (
          <p className="text-base text-muted-foreground leading-relaxed">
            {item.description}
          </p>
        )}
        <div className="mt-6 border-b border-border" />
      </header>
      <div className="pt-2">
        <Renderer content={{ markdown }} />
      </div>
    </article>
  );
}
