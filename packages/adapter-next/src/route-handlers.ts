import type { CMSGlobalOps, InvalidateScope } from "@notion-headless-cms/core";

export interface RevalidateHandlerOptions {
  /** Webhook 検証用シークレット。Authorization ヘッダと照合する。 */
  secret: string;
}

/**
 * `/app/api/images/[hash]/route.ts` 用の Next.js ルートハンドラを生成する。
 * 内部的に `cms.$getCachedImage()` を呼ぶ。
 *
 * @example
 * // app/api/images/[hash]/route.ts
 * import { cms } from "@/lib/cms";
 * import { createImageRouteHandler } from "@notion-headless-cms/adapter-next";
 * export const GET = createImageRouteHandler(cms);
 */
export function createImageRouteHandler(
  cms: CMSGlobalOps,
): (
  request: Request,
  context: { params: Promise<{ hash: string }> },
) => Promise<Response> {
  return async (_request, context) => {
    const { hash } = await context.params;
    const object = await cms.$getCachedImage(hash);
    if (!object) return new Response("Not Found", { status: 404 });
    const headers = new Headers();
    if (object.contentType) headers.set("content-type", object.contentType);
    headers.set("cache-control", "public, max-age=31536000, immutable");
    return new Response(object.data, { headers });
  };
}

/**
 * `/app/api/revalidate/[collection]/route.ts` 用の Next.js ルートハンドラを生成する。
 * Authorization ヘッダで secret を検証し、`cms.$invalidate({ collection, slug? })` を呼ぶ。
 *
 * @example
 * // app/api/revalidate/[collection]/route.ts
 * import { cms } from "@/lib/cms";
 * import { createCollectionRevalidateRouteHandler } from "@notion-headless-cms/adapter-next";
 * export const POST = createCollectionRevalidateRouteHandler(cms, { secret: process.env.REVALIDATE_SECRET! });
 */
export function createCollectionRevalidateRouteHandler(
  cms: CMSGlobalOps,
  opts: RevalidateHandlerOptions,
): (
  req: Request,
  context: { params: Promise<{ collection: string }> },
) => Promise<Response> {
  return async (req, context) => {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${opts.secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { collection } = await context.params;

    let slug: string | undefined;
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      let payload: unknown;
      try {
        payload = await req.json();
      } catch {
        return Response.json(
          { ok: false, reason: "invalid JSON" },
          { status: 400 },
        );
      }
      if (
        payload !== null &&
        typeof payload === "object" &&
        "slug" in payload &&
        typeof (payload as { slug: unknown }).slug === "string"
      ) {
        slug = (payload as { slug: string }).slug;
      }
    }

    const scope: InvalidateScope = slug ? { collection, slug } : { collection };

    await cms.$invalidate(scope);
    return Response.json({ ok: true, scope });
  };
}

/**
 * 全コレクションを一括無効化するルートハンドラを生成する。管理用エンドポイント向け。
 * Authorization ヘッダで secret を検証し、`cms.$invalidate("all")` を呼ぶ。
 *
 * @example
 * // app/api/revalidate/route.ts
 * import { cms } from "@/lib/cms";
 * import { createInvalidateAllRouteHandler } from "@notion-headless-cms/adapter-next";
 * export const POST = createInvalidateAllRouteHandler(cms, { secret: process.env.REVALIDATE_SECRET! });
 */
export function createInvalidateAllRouteHandler(
  cms: CMSGlobalOps,
  opts: RevalidateHandlerOptions,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${opts.secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    await cms.$invalidate("all");
    return Response.json({ ok: true, scope: "all" });
  };
}
