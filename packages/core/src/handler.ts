import { isCMSError } from "./errors";
import type { ImageCacheOps, InvalidateScope } from "./types/index";

export interface HandlerOptions {
  /** マウントするベースパス。デフォルト `/api/cms`。 */
  basePath?: string;
  /** 画像プロキシのパス (basePath 相対)。デフォルト `/images/:hash`。 */
  imagesPath?: string;
  /** revalidate webhook のパス (basePath 相対)。デフォルト `/revalidate`。 */
  revalidatePath?: string;
  /** バージョン照会 (peekVersion) のパス (basePath 相対)。デフォルト `/versions`。 */
  versionsPath?: string;
  /** 更新チェック (check) のパス (basePath 相対)。デフォルト `/check`。 */
  checkPath?: string;
  /** Webhook 署名検証用シークレット (未指定なら検証スキップ)。 */
  webhookSecret?: string;
  /** デフォルト実装を無効化する場合 true。 */
  disabled?: boolean;
}

export interface HandlerAdapter {
  imageCache: ImageCacheOps;
  /**
   * 指定コレクションの DataSource.parseWebhook を呼ぶ。
   * 未知コレクション → `handler/unknown_collection` CMSError
   * parseWebhook 未実装 → `webhook/not_implemented` CMSError
   */
  parseWebhookFor(
    collection: string,
    req: Request,
    webhookSecret: string | undefined,
  ): Promise<InvalidateScope>;
  revalidate(scope: InvalidateScope): Promise<void>;
  /**
   * 指定コレクション / slug の `peekVersion`（KV メタのみ、Notion API 非呼び出し）を返す。
   * キャッシュ未登録なら `null`。未知コレクション → `handler/unknown_collection` CMSError。
   */
  peekVersionFor(
    collection: string,
    slug: string,
  ): Promise<{ notionUpdatedAt: string; cachedAt: number } | null>;
  /**
   * 指定コレクション / slug を `currentVersion` と比較し（Notion を実照会）、
   * 差分があればキャッシュを更新して `stale` を返す。
   * アイテムが存在しない場合は `null`。未知コレクション → `handler/unknown_collection` CMSError。
   */
  checkFor(
    collection: string,
    slug: string,
    currentVersion: string,
  ): Promise<{ stale: boolean } | null>;
}

const DEFAULT_OPTS = {
  basePath: "/api/cms",
  imagesPath: "/images",
  revalidatePath: "/revalidate",
  versionsPath: "/versions",
  checkPath: "/check",
} as const;

const JSON_HEADERS = { "content-type": "application/json" } as const;

function httpStatusForError(code: string): number | null {
  if (code === "webhook/signature_invalid") return 401;
  if (code === "webhook/not_implemented") return 501;
  if (code === "webhook/unknown_collection") return 404;
  if (code === "webhook/payload_invalid") return 400;
  if (code === "handler/unknown_collection") return 404;
  return null;
}

function errorResponse(err: unknown): Response | null {
  if (!isCMSError(err)) return null;
  const status = httpStatusForError(err.code);
  if (status === null) return null;
  return new Response(JSON.stringify({ ok: false, code: err.code }), {
    status,
    headers: JSON_HEADERS,
  });
}

function splitCollectionSlug(
  sub: string,
): { collection: string; slug: string } | null {
  const slashIndex = sub.indexOf("/");
  if (slashIndex <= 0 || slashIndex === sub.length - 1) return null;
  return {
    collection: sub.slice(0, slashIndex),
    slug: sub.slice(slashIndex + 1),
  };
}

/**
 * Web Standard な Request → Response ルーター。
 * Next.js / React Router / Hono / Cloudflare Workers いずれでも使える。
 *
 * ルート:
 * - GET       `{basePath}/images/:hash`               — 画像プロキシ
 * - GET       `{basePath}/versions/:collection/:slug` — peekVersion（更新検知ポーリング）
 * - GET/POST  `{basePath}/check/:collection/:slug?v=` — check（更新を実照会してキャッシュ更新）
 * - POST      `{basePath}/revalidate/:collection`     — Webhook 受信 + $revalidate()
 */
export function createHandler(
  adapter: HandlerAdapter,
  opts: HandlerOptions = {},
): (req: Request) => Promise<Response> {
  const basePath = trimTrailingSlash(opts.basePath ?? DEFAULT_OPTS.basePath);
  const imagesPath = opts.imagesPath ?? DEFAULT_OPTS.imagesPath;
  const revalidatePath = opts.revalidatePath ?? DEFAULT_OPTS.revalidatePath;
  const versionsPath = opts.versionsPath ?? DEFAULT_OPTS.versionsPath;
  const checkPath = opts.checkPath ?? DEFAULT_OPTS.checkPath;

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;

    if (!path.startsWith(basePath)) {
      return new Response("Not Found", { status: 404 });
    }
    const rel = path.slice(basePath.length) || "/";

    if (req.method === "GET" && rel.startsWith(`${imagesPath}/`)) {
      const hash = rel.slice(imagesPath.length + 1);
      if (!hash) return new Response("Bad Request", { status: 400 });
      const object = await adapter.imageCache.get(hash);
      if (!object) return new Response("Not Found", { status: 404 });
      const headers = new Headers();
      if (object.contentType) headers.set("content-type", object.contentType);
      headers.set("cache-control", "public, max-age=31536000, immutable");
      return new Response(object.data, { headers });
    }

    if (req.method === "GET" && rel.startsWith(`${versionsPath}/`)) {
      const target = splitCollectionSlug(rel.slice(versionsPath.length + 1));
      if (!target) {
        return new Response(
          JSON.stringify({ ok: false, reason: "collection and slug required" }),
          { status: 400, headers: JSON_HEADERS },
        );
      }
      try {
        const version = await adapter.peekVersionFor(
          target.collection,
          target.slug,
        );
        // 値が無い場合も 200 + null を返す（ポーリング側は null を「未確定」として継続する）。
        return new Response(JSON.stringify(version), {
          status: 200,
          headers: JSON_HEADERS,
        });
      } catch (err) {
        const res = errorResponse(err);
        if (res) return res;
        throw err;
      }
    }

    if (
      (req.method === "GET" || req.method === "POST") &&
      rel.startsWith(`${checkPath}/`)
    ) {
      const target = splitCollectionSlug(rel.slice(checkPath.length + 1));
      const currentVersion = url.searchParams.get("v");
      if (!target || !currentVersion) {
        return new Response(
          JSON.stringify({
            ok: false,
            reason: "collection, slug and ?v= are required",
          }),
          { status: 400, headers: JSON_HEADERS },
        );
      }
      try {
        const result = await adapter.checkFor(
          target.collection,
          target.slug,
          currentVersion,
        );
        if (result === null) {
          return new Response(
            JSON.stringify({ ok: false, reason: "not found" }),
            {
              status: 404,
              headers: JSON_HEADERS,
            },
          );
        }
        return new Response(JSON.stringify({ stale: result.stale }), {
          status: 200,
          headers: JSON_HEADERS,
        });
      } catch (err) {
        const res = errorResponse(err);
        if (res) return res;
        throw err;
      }
    }

    if (req.method === "POST" && rel.startsWith(`${revalidatePath}/`)) {
      const collection = rel.slice(revalidatePath.length + 1);
      if (!collection || collection.includes("/")) {
        return new Response(
          JSON.stringify({ ok: false, reason: "collection required" }),
          { status: 400, headers: JSON_HEADERS },
        );
      }
      try {
        const scope = await adapter.parseWebhookFor(
          collection,
          req,
          opts.webhookSecret,
        );
        await adapter.revalidate(scope);
        return new Response(JSON.stringify({ ok: true, scope }), {
          status: 200,
          headers: JSON_HEADERS,
        });
      } catch (err) {
        const res = errorResponse(err);
        if (res) return res;
        throw err;
      }
    }

    return new Response("Not Found", { status: 404 });
  };
}

function trimTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}
