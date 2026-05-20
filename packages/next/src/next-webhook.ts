import type { CMSGlobalOps, InvalidateScope } from "@notion-headless-cms/core";

/**
 * `createNextWebhookHandler(cms, ...)` の動的タグ / パス計算。
 * Webhook ペイロードから決まる `InvalidateScope` を受け、その時点で revalidate すべき
 * タグ / パスのリストを返す。
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
   *
   * - `{ tags, paths }` を直接指定すると、すべての webhook で同じタグ / パスを revalidate する
   * - 関数 (`NextRevalidateResolver`) を指定すると、webhook ペイロードから決まる `InvalidateScope` を見て
   *   `tags` / `paths` を都度決められる (例: コレクション別にタグを使い分ける)
   */
  revalidate?:
    | { tags?: readonly string[]; paths?: readonly string[] }
    | NextRevalidateResolver;
}

/**
 * Next.js App Router 向けの Webhook → revalidate ハンドラを生成する。
 *
 * `cms.handler({ webhookSecret })` の上に薄く乗せたヘルパーで、以下を 1 つの POST で完結させる:
 *
 * 1. Webhook ペイロード検証 (`DataSource.parseWebhook` で実装)
 * 2. `cms.invalidate(scope)` で document/image キャッシュを無効化
 * 3. `next/cache` の `revalidateTag` / `revalidatePath` を呼んで Next.js ISR キャッシュも掃く
 *
 * 低レイヤの `createNextHandler` は引き続き利用可能 (画像プロキシも同居する場合はそちらを使う)。
 *
 * @example
 * // app/api/cms/webhook/[collection]/route.ts
 * import { cms } from "@/lib/cms";
 * import { createNextWebhookHandler } from "@notion-headless-cms/next";
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
  // basePath をルート相対 (`/webhook`) にし、`POST /<basePath>/<collection>` で受ける。
  // App Router の dynamic segment と組み合わせやすい形にしてある。
  const baseHandler = cms.handler({
    basePath: "/__nhc",
    imagesPath: "/never-images",
    revalidatePath: "/revalidate",
    webhookSecret: opts.secret,
  });

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    // collection 名は dynamic segment から取るのが現実的だが、route.ts ハンドラ内では
    // params にアクセスできないので URL の末尾セグメントから抽出する。
    const collection = url.pathname.split("/").filter(Boolean).pop();
    if (!collection) {
      return new Response(
        JSON.stringify({ ok: false, reason: "collection segment missing" }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }

    // ベースハンドラが期待する URL 形 (`/__nhc/revalidate/<collection>`) にリライトする。
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

    // 200 のときだけ Next.js キャッシュも掃く。scope はレスポンス JSON から取り出す。
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
      // next の API シグネチャはバージョン毎に変わるので、any-cast で吸収する。
      // 戻り値も void 系で握りつぶす想定。
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
