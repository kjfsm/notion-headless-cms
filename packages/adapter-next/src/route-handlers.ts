import type { CMSGlobalOps, InvalidateScope } from "@notion-headless-cms/core";

export interface RevalidateHandlerOptions {
  /** Webhook 検証用シークレット。Authorization ヘッダと照合する。 */
  secret: string;
}

export interface NextHandlerOptions {
  /** Webhook 検証用シークレット。Authorization ヘッダと照合する。 */
  webhookSecret?: string;
}

/**
 * Next.js App Router 向けの統合ルートハンドラを生成する。
 * 画像プロキシ (`GET /api/cms/images/[hash]`) と
 * Webhook による invalidate (`POST /api/cms/...`) を1つのハンドラで処理する。
 *
 * @example
 * // app/api/cms/[...path]/route.ts
 * import { cms } from "@/lib/cms";
 * import { createNextHandler } from "@notion-headless-cms/adapter-next";
 *
 * const handler = createNextHandler(cms, { webhookSecret: process.env.WEBHOOK_SECRET });
 * export const GET = handler;
 * export const POST = handler;
 */
export function createNextHandler(
  cms: CMSGlobalOps,
  opts?: NextHandlerOptions,
): (req: Request) => Promise<Response> {
  return cms.handler({ webhookSecret: opts?.webhookSecret });
}

/**
 * @deprecated `createNextHandler` を使用してください。
 *
 * `/app/api/images/[hash]/route.ts` 用の Next.js ルートハンドラを生成する。
 */
export function createImageRouteHandler(
  cms: CMSGlobalOps,
): (
  request: Request,
  context: { params: Promise<{ hash: string }> },
) => Promise<Response> {
  return async (_request, context) => {
    const { hash } = await context.params;
    const object = await cms.getCachedImage(hash);
    if (!object) return new Response("Not Found", { status: 404 });
    const headers = new Headers();
    if (object.contentType) headers.set("content-type", object.contentType);
    headers.set("cache-control", "public, max-age=31536000, immutable");
    return new Response(object.data, { headers });
  };
}

/**
 * @deprecated `createNextHandler` を使用してください。
 *
 * `/app/api/revalidate/[collection]/route.ts` 用の Next.js ルートハンドラを生成する。
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

    await cms.invalidate(scope);
    return Response.json({ ok: true, scope });
  };
}

/**
 * @deprecated `createNextHandler` を使用してください。
 *
 * 全コレクションを一括無効化するルートハンドラを生成する。管理用エンドポイント向け。
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
    await cms.invalidate("all");
    return Response.json({ ok: true, scope: "all" });
  };
}
