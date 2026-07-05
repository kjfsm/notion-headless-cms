import { NotionRenderer } from "@notion-headless-cms/react-renderer";
import { NotionRevalidator } from "@notion-headless-cms/react-renderer/router";
import {
  denormalizeBlocks,
  toPageLinkMap,
} from "@notion-headless-cms/react-renderer/v3";
import { Link, redirect } from "react-router";
import { makeCms } from "../lib/cms";
import { remapPageLinks } from "../lib/cms-helpers";
import type { Route } from "./+types/index";

export async function loader({ context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  const entry = await cms.pages.find("home");
  if (!entry) return redirect("/docs");
  const blocks = denormalizeBlocks(entry.blocks);
  const pageLinks = remapPageLinks(toPageLinkMap(entry.links));
  return {
    blocks,
    pageLinks,
    item: entry.meta,
  };
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  return [
    {
      title: loaderData?.item.name
        ? `${loaderData.item.name} | notion-headless-cms`
        : "notion-headless-cms",
    },
  ];
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const { blocks, pageLinks, item } = loaderData;
  return (
    <main className="animate-fade-in-up">
      <NotionRevalidator on={["mount", "visibility"]} />

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
            {item.name ?? "NOTION-HEADLESS-CMS"}
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
        <NotionRenderer blocks={blocks} pageLinks={pageLinks} />
      </article>
    </main>
  );
}
