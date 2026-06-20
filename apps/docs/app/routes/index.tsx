import { isReloadRequest } from "@notion-headless-cms/client";
import { NotionRevalidator, Renderer } from "@notion-headless-cms/client/react";
import { Link, redirect } from "react-router";
import { makeCms } from "../lib/cms";
import type { Route } from "./+types/index";

export async function loader({ request, context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  // 明示リロード（F5）時は recheck ウィンドウを無視して Notion を再取得する。
  const page = await cms.pages.find("home", {
    force: isReloadRequest(request),
  });
  if (!page) return redirect("/docs");
  // fetch-blocks 戦略で Notion BlockObjectResponse ツリーを取得し、
  // react-renderer の <Renderer> で callout / column / embed を React コンポーネントに展開する。
  const blocks = await page.notionBlocks();
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
    <main className="animate-fade-in-up">
      <NotionRevalidator
        poll={{
          url: `/api/pages/${item.slug}/check`,
          version: item.lastEditedTime,
        }}
      />

      {/* バンドサイトと同じ放射状グラデのヒーロー。clamp() で見出しを流体スケーリング */}
      <section className="bg-[radial-gradient(ellipse_at_top,#f3e8ff_0%,#fff_60%)]">
        <div className="mx-auto max-w-5xl px-6 pt-24 pb-16 text-center">
          <p className="mb-4 font-mono text-xs uppercase tracking-widest text-purple-500">
            Notion → Cloudflare → React Router
          </p>
          <h1
            className="font-black tracking-tighter leading-none text-gray-900"
            style={{ fontSize: "clamp(2.75rem, 9vw, 7rem)" }}
          >
            {item.title ?? "NOTION-HEADLESS-CMS"}
          </h1>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/docs"
              className="inline-flex items-center rounded-full bg-purple-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-purple-500"
            >
              ドキュメントを読む
            </Link>
            <a
              href="https://github.com/kjfsm/notion-headless-cms"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full border border-gray-200 bg-white px-6 py-2.5 text-sm font-medium text-gray-900 transition hover:border-purple-400 hover:text-purple-600"
            >
              GitHub
            </a>
          </div>
        </div>
      </section>

      <article className="mx-auto max-w-3xl px-6 py-16 prose prose-neutral max-w-none prose-headings:tracking-tighter prose-headings:font-bold prose-a:text-purple-600 prose-a:no-underline hover:prose-a:underline prose-code:text-purple-600">
        <Renderer blocks={blocks} />
      </article>
    </main>
  );
}
