import { NotionRenderer } from "@notion-headless-cms/react-renderer";
import { useNotionRevalidate } from "@notion-headless-cms/react-renderer/router";
import {
  denormalizeBlocks,
  toPageLinkMap,
} from "@notion-headless-cms/react-renderer/v3";
import { data, isRouteErrorResponse } from "react-router";
import { ensureSynced, makeCms } from "../lib/cms";
import { cloudflareContext } from "../lib/context";
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

export async function loader({ params, context }: Route.LoaderArgs) {
  try {
    const { env, ctx } = context.get(cloudflareContext);
    const cms = makeCms(env, ctx);
    await ensureSynced(cms);
    const post = await cms.posts.find(params.slug ?? "");
    if (!post) throw data("Not Found", { status: 404 });
    return { post };
  } catch (err) {
    if (isRouteErrorResponse(err)) throw err;
    console.error("[posts loader] エラー:", err);
    throw data(serializeError(err), { status: 500 });
  }
}

export default function Post({ loaderData }: Route.ComponentProps) {
  const { post } = loaderData;
  const meta = post.meta as {
    名前?: string | null;
    公開日?: string | null;
  };
  // mount / 再フォーカス時に loader を再走させ、裏で進んだ同期結果を反映する。
  useNotionRevalidate();
  return (
    <article>
      <h1>{meta.名前 ?? post.slug}</h1>
      {meta.公開日 && <time>{meta.公開日}</time>}
      <NotionRenderer
        blocks={denormalizeBlocks(post.blocks)}
        pageLinks={toPageLinkMap(post.links)}
      />
    </article>
  );
}
