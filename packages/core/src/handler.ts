import { isCMSError } from "./errors";
import type { ImageCacheOps, InvalidateScope } from "./types/index";

/** `$handler()` の挙動設定。 */
export interface HandlerOptions {
  /** マウントするベースパス。デフォルト `/api/cms`。 */
  basePath?: string;
  /** 画像プロキシのパス (basePath 相対)。デフォルト `/images/:hash`。 */
  imagesPath?: string;
  /** revalidate webhook のパス (basePath 相対)。デフォルト `/revalidate`。 */
  revalidatePath?: string;
  /** バージョン照会 (peekVersion) のパス (basePath 相対)。デフォルト `/versions`。 */
  versionsPath?: string;
  /** Webhook 署名検証用シークレット (未指定なら検証スキップ)。 */
  webhookSecret?: string;
  /** デフォルト実装を無効化する場合 true。 */
  disabled?: boolean;
}

/** `$handler()` が内部で依存する CMS 機能の最小セット。 */
export interface HandlerAdapter {
  imageCache: ImageCacheOps;
  /**
   * 指定コレクションの DataSource.parseWebhook を呼ぶ。
   * 未知コレクション → `webhook/unknown_collection` CMSError
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
   * キャッシュ未登録なら `null`。未知コレクション → `version/unknown_collection` CMSError。
   */
  peekVersionFor(
    collection: string,
    slug: string,
  ): Promise<{ notionUpdatedAt: string; cachedAt: number } | null>;
}

const DEFAULT_OPTS = {
  basePath: "/api/cms",
  imagesPath: "/images",
  revalidatePath: "/revalidate",
  versionsPath: "/versions",
} as const;

/** CMSError コードを HTTP ステータスへ写像する。未対応コードは null。 */
function httpStatusForError(code: string): number | null {
  if (code === "webhook/signature_invalid") return 401;
  if (code === "webhook/not_implemented") return 501;
  if (code === "webhook/unknown_collection") return 404;
  if (code === "webhook/payload_invalid") return 400;
  if (code === "version/unknown_collection") return 404;
  return null;
}

/**
 * Web Standard な Request → Response ルーター。
 * Next.js / React Router / Hono / Cloudflare Workers いずれでも使える。
 *
 * ルート:
 * - GET  `{basePath}/images/:hash`              — 画像プロキシ
 * - GET  `{basePath}/versions/:collection/:slug` — peekVersion（更新検知ポーリング）
 * - POST `{basePath}/revalidate/:collection`    — Webhook 受信 + $revalidate()
 */
export function createHandler(
  adapter: HandlerAdapter,
  opts: HandlerOptions = {},
): (req: Request) => Promise<Response> {
  const basePath = trimTrailingSlash(opts.basePath ?? DEFAULT_OPTS.basePath);
  const imagesPath = opts.imagesPath ?? DEFAULT_OPTS.imagesPath;
  const revalidatePath = opts.revalidatePath ?? DEFAULT_OPTS.revalidatePath;
  const versionsPath = opts.versionsPath ?? DEFAULT_OPTS.versionsPath;

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
      const sub = rel.slice(versionsPath.length + 1);
      const slashIndex = sub.indexOf("/");
      // `:collection/:slug` の双方が必要。どちらか欠ける場合は 400。
      if (slashIndex <= 0 || slashIndex === sub.length - 1) {
        return new Response(
          JSON.stringify({ ok: false, reason: "collection and slug required" }),
          { status: 400, headers: { "content-type": "application/json" } },
        );
      }
      const collection = sub.slice(0, slashIndex);
      const slug = sub.slice(slashIndex + 1);
      try {
        const version = await adapter.peekVersionFor(collection, slug);
        // 値が無い場合も 200 + null を返す（ポーリング側は null を「未確定」として継続する）。
        return new Response(JSON.stringify(version), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      } catch (err) {
        if (isCMSError(err)) {
          const status = httpStatusForError(err.code);
          if (status !== null) {
            return new Response(JSON.stringify({ ok: false, code: err.code }), {
              status,
              headers: { "content-type": "application/json" },
            });
          }
        }
        throw err;
      }
    }

    if (req.method === "POST" && rel.startsWith(`${revalidatePath}/`)) {
      const collection = rel.slice(revalidatePath.length + 1);
      if (!collection || collection.includes("/")) {
        return new Response(
          JSON.stringify({ ok: false, reason: "collection required" }),
          { status: 400, headers: { "content-type": "application/json" } },
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
          headers: { "content-type": "application/json" },
        });
      } catch (err) {
        if (isCMSError(err)) {
          const status = httpStatusForError(err.code);
          if (status !== null) {
            return new Response(JSON.stringify({ ok: false, code: err.code }), {
              status,
              headers: { "content-type": "application/json" },
            });
          }
        }
        throw err;
      }
    }

    return new Response("Not Found", { status: 404 });
  };
}

function trimTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}
