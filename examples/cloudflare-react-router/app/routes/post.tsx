import { NotionRevalidator } from "@notion-headless-cms/react-renderer/router";
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
    code: typeof e["code"] === "string" ? e["code"] : null,
    stack: err instanceof Error ? (err.stack ?? null) : null,
    cause: e["cause"] != null ? serializeError(e["cause"], depth + 1) : null,
  };
}

export async function loader({ params, context }: Route.LoaderArgs) {
  try {
    const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
    const post = await cms.posts.find(params.slug ?? "");
    if (!post) throw data("Not Found", { status: 404 });
    // markdownFetcher 戦略を使っているため Notion ブロックツリーは取れない。
    // 代わりに post.html() を使う — cms.ts の renderer (embed プロバイダ含む)
    // を通った HTML 文字列が返る。
    const html = await post.html();
    return {
      html,
      item: {
        slug: post.slug,
        title: post.title,
        publishedAt: post.publishedAt,
        lastEditedTime: post.lastEditedTime,
      },
    };
  } catch (err) {
    // isRouteErrorResponse な data() は上のコードが投げるのでそのまま通す
    if (isRouteErrorResponse(err)) throw err;
    console.error("[posts loader] エラー:", err);
    // ErrorBoundary へシリアライズ可能な形で渡す（CMSError.cause 等が非直列化可能なため）
    throw data(serializeError(err), { status: 500 });
  }
}

export default function Post({ loaderData }: Route.ComponentProps) {
  const { html, item } = loaderData;
  return (
    <article>
      <NotionRevalidator
        poll={{
          url: `/api/posts/${item.slug}/check`,
          version: item.lastEditedTime,
        }}
      />
      <h1>{item.title ?? item.slug}</h1>
      {item.publishedAt && <time>{item.publishedAt}</time>}
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: cms renderer の出力を信頼する */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
