import type {
  CacheAdapter,
  CMSGlobalOps,
  InvalidateScope,
  MemoryCacheOptions,
  SWRConfig,
} from "@notion-headless-cms/core";
import { memoryCache } from "@notion-headless-cms/core";

// createCMS({ cache: { document: nextCache({ tags }) } }) で ISR 連携の文書キャッシュとして渡す。
export type { NextCacheOptions } from "@notion-headless-cms/cache/next";
export { nextCache } from "@notion-headless-cms/cache/next";

/** `nextPreset()` のオプション。 */
export interface NextPresetOptions {
  /** メモリキャッシュ設定。 */
  cache?: MemoryCacheOptions;
  /** SWR (Stale-While-Revalidate) 設定。デフォルト ttlMs 5 分。 */
  swr?: SWRConfig;
}

/**
 * Next.js (App Router) 向け低レベル `createClient` プリセット。`...nextPreset()` を
 * `createClient` にスプレッドして使う。`createCMS` を使う場合は
 * `cache: { document: nextCache({ tags }), image: memoryCache() }` のように役割別に組み立てる。
 */
export function nextPreset(opts: NextPresetOptions = {}): {
  cache: CacheAdapter[];
  swr: SWRConfig;
} {
  return {
    cache: [memoryCache(opts.cache)],
    swr: opts.swr ?? { ttlMs: 5 * 60_000 },
  };
}

export interface NextHandlerOptions {
  /** Webhook 検証用シークレット。Authorization ヘッダと照合する。 */
  webhookSecret?: string;
}

/**
 * Next.js App Router 向けの統合ルートハンドラを生成する。
 * 画像プロキシ (`GET /api/cms/images/[hash]`) と Webhook による invalidate
 * (`POST /api/cms/...`) を 1 つのハンドラで処理する。
 *
 * @example
 * // app/api/cms/[...path]/route.ts
 * import { cms } from "@/lib/cms";
 * import { createNextHandler } from "@notion-headless-cms/client/next";
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
 * `createNextWebhookHandler(cms, ...)` の動的タグ / パス計算。
 */
export type NextRevalidateResolver = (scope: InvalidateScope) => {
  tags?: readonly string[];
  paths?: readonly string[];
};

export interface NextWebhookOptions {
  /**
   * Webhook 検証用シークレット。`DataSource.parseWebhook` がサポートしている場合に使われる。
   * 未指定なら署名検証はスキップされる (公開エンドポイントを直接叩く可能性に注意)。
   */
  secret?: string;
  /**
   * 受信した webhook ごとに無効化する対象。固定値またはペイロード由来の動的計算が可能。
   */
  revalidate?:
    | { tags?: readonly string[]; paths?: readonly string[] }
    | NextRevalidateResolver;
}

/**
 * Next.js App Router 向けの Webhook → revalidate ハンドラを生成する。
 *
 * 1. Webhook ペイロード検証 (`DataSource.parseWebhook` で実装)
 * 2. `cms.invalidate(scope)` で document/image キャッシュを無効化
 * 3. `next/cache` の `revalidateTag` / `revalidatePath` を呼んで Next.js ISR キャッシュも掃く
 *
 * @example
 * // app/api/cms/webhook/[collection]/route.ts
 * import { cms } from "@/lib/cms";
 * import { createNextWebhookHandler } from "@notion-headless-cms/client/next";
 *
 * export const POST = createNextWebhookHandler(cms, {
 *   secret: process.env.NOTION_WEBHOOK_SECRET,
 *   revalidate: (scope) => ({
 *     tags: typeof scope === "object" && "collection" in scope ? [scope.collection] : ["all"],
 *     paths: ["/posts"],
 *   }),
 * });
 */
export function createNextWebhookHandler(
  cms: CMSGlobalOps,
  opts: NextWebhookOptions = {},
): (req: Request) => Promise<Response> {
  const baseHandler = cms.handler({
    basePath: "/__nhc",
    imagesPath: "/never-images",
    revalidatePath: "/revalidate",
    webhookSecret: opts.secret,
  });

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const collection = url.pathname.split("/").filter(Boolean).pop();
    if (!collection) {
      return new Response(
        JSON.stringify({ ok: false, reason: "collection segment missing" }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }

    const rewritten = new URL(req.url);
    rewritten.pathname = `/__nhc/revalidate/${collection}`;
    const innerReq = new Request(rewritten.toString(), {
      method: req.method,
      headers: req.headers,
      body: req.body,
      // @ts-expect-error duplex は環境によって型定義が無い
      duplex: "half",
    });

    const res = await baseHandler(innerReq);
    if (res.status !== 200) return res;

    const body = (await res
      .clone()
      .json()
      .catch(() => null)) as { ok: boolean; scope?: InvalidateScope } | null;
    const scope: InvalidateScope = body?.scope ?? "all";

    const targets =
      typeof opts.revalidate === "function"
        ? opts.revalidate(scope)
        : (opts.revalidate ?? {});

    if (targets.tags?.length || targets.paths?.length) {
      // next の API シグネチャはバージョン毎に変わるので、戻り値は握りつぶす想定。
      const next = (await import("next/cache").catch(
        () => null,
      )) as unknown as {
        revalidateTag?: (...args: unknown[]) => unknown;
        revalidatePath?: (...args: unknown[]) => unknown;
      } | null;
      if (next) {
        if (next.revalidateTag && targets.tags) {
          for (const tag of targets.tags) next.revalidateTag(tag);
        }
        if (next.revalidatePath && targets.paths) {
          for (const path of targets.paths) next.revalidatePath(path);
        }
      }
    }

    return res;
  };
}
