import { buildPageLinkMap, isReloadRequest } from "@notion-headless-cms/client";
import { NotionRevalidator, Renderer } from "@notion-headless-cms/client/react";
import { data, isRouteErrorResponse } from "react-router";
import { makeCms } from "../lib/cms";
import type { Route } from "./+types/post";

type SerializedError = {
  message: string;
  code: string | null;
  stack: string | null;
  cause: SerializedError | null;
};

function serializeError(err: unknown, depth = 0): SerializedError {
  if (depth > 5)
    return { message: "(too deep)", code: null, stack: null, cause: null };
  const e = err as Record<string, unknown>;
  return {
    message: err instanceof Error ? err.message : String(err),
    code: typeof e.code === "string" ? e.code : null,
    stack: err instanceof Error ? (err.stack ?? null) : null,
    cause: e.cause != null ? serializeError(e.cause, depth + 1) : null,
  };
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  try {
    const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
    // 明示リロード（F5）時は recheck ウィンドウを無視して Notion を再取得する。
    const post = await cms.posts.find(params.slug ?? "", {
      force: isReloadRequest(request),
    });
    if (!post) throw data("Not Found", { status: 404 });
    const blocks = await post.notionBlocks();
    // Notion 内部リンク（link_to_page / page mention）を自サイト URL に解決するマップ。
    // プレーンオブジェクトなので loader 経由でそのままコンポーネントに渡せる。
    const pageLinks = await buildPageLinkMap(cms);
    return {
      blocks,
      pageLinks,
      item: {
        slug: post.slug,
        title: post.title,
        publishedAt: post.publishedAt,
        lastEditedTime: post.lastEditedTime,
      },
    };
  } catch (err) {
    if (isRouteErrorResponse(err)) throw err;
    console.error("[posts loader] エラー:", err);
    throw data(serializeError(err), { status: 500 });
  }
}

export default function Post({ loaderData }: Route.ComponentProps) {
  const { blocks, pageLinks, item } = loaderData;
  return (
    <article>
      {/*
        realtime（Durable Object）を主経路にし、WebSocket push で即時 revalidate する。
        DO 有効時は poll は停止する。poll は DO 未 binding 環境のフォールバック
        （mount / 再フォーカスで POST /api/cms/check/posts/:slug?v= を叩き stale なら revalidate）。
      */}
      <NotionRevalidator
        realtime={{ collection: "posts", item: { slug: item.slug } }}
        poll={{ collection: "posts", item }}
      />
      <h1>{item.title ?? item.slug}</h1>
      {item.publishedAt && <time>{item.publishedAt}</time>}
      <Renderer blocks={blocks} pageLinks={pageLinks} />
    </article>
  );
}
