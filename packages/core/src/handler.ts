import { isCMSError } from "./errors";
import type { ImageCacheOps, InvalidateScope, Logger } from "./types/index";

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
  /** Notion 公式 webhook 受信のパス (basePath 相対)。デフォルト `/notion-webhook`。 */
  notionWebhookPath?: string;
  /** Webhook 署名検証用シークレット (未指定なら検証スキップ)。 */
  webhookSecret?: string;
  /** Notion 公式 webhook（integration の Webhooks）の受信設定。 */
  notionWebhook?: {
    /**
     * 検証トークン（HMAC-SHA256 署名キー）。未指定時は createCMS の
     * `notion.webhookSecret`（= `CreateClientOptions.notionWebhookSecret`）を既定で使う。
     */
    secret?: string;
    /**
     * サブスク登録時に Notion が送る `verification_token` を受け取るコールバック。
     * 値を控えて `notion.webhookSecret` に設定する用途（既定ではレスポンス本文にも echo する）。
     */
    onVerificationToken?: (token: string) => void;
  };
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
  /**
   * Notion ページ ID を全コレクション横断で解決し単件ウォームする（公式 webhook 用）。
   * 一致したコレクション（ページは slug も含む。要素コレクションは含まない）、無ければ `null`。
   */
  warmByPageId(
    pageId: string,
  ): Promise<{ collection: string; slug?: string } | null>;
  /** createCMS で設定された Notion webhook 検証トークンの既定値。 */
  notionWebhookSecret?: string;
  /** 応答送信後もウォームを完走させる実行フック (Cloudflare の `waitUntil` 相当)。 */
  scheduleBackground?: (p: Promise<unknown>) => void;
  /** webhook 受信・キャッシュ更新のログ出力先。 */
  logger?: Logger;
}

const DEFAULT_OPTS = {
  basePath: "/api/cms",
  imagesPath: "/images",
  revalidatePath: "/revalidate",
  versionsPath: "/versions",
  checkPath: "/check",
  notionWebhookPath: "/notion-webhook",
} as const;

const JSON_HEADERS = { "content-type": "application/json" } as const;

/** HMAC-SHA256 を hex で返す。core はゼロ依存のため import せずグローバル `crypto.subtle` を使う。 */
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  let hex = "";
  for (const b of new Uint8Array(sig)) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** タイミング攻撃を避ける定数時間文字列比較。 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function httpStatusForError(code: string): number | null {
  if (code === "webhook/signature_invalid") return 401;
  if (code === "webhook/not_implemented") return 501;
  if (code === "webhook/unknown_collection") return 404;
  if (code === "webhook/payload_invalid") return 400;
  if (code === "handler/unknown_collection") return 404;
  if (code === "handler/version_unsupported") return 400;
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
  const notionWebhookPath =
    opts.notionWebhookPath ?? DEFAULT_OPTS.notionWebhookPath;

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
      if (!object) {
        // ハッシュがキャッシュに無い 404 を監視できるよう記録する（期限切れ画像の取り逃し検知用）。
        adapter.logger?.warn?.("画像プロキシ: ハッシュ未ヒット", {
          operation: "handler.image",
          imageHash: hash,
          status: 404,
        });
        return new Response("Not Found", { status: 404 });
      }
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

    if (req.method === "POST" && rel === notionWebhookPath) {
      const raw = await req.text();
      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        return jsonResponse({ ok: false, reason: "invalid json" }, 400);
      }

      // サブスク登録時の検証: verification_token を控えられるよう echo + コールバック。
      if (
        payload &&
        typeof payload === "object" &&
        "verification_token" in payload
      ) {
        const token = String(
          (payload as Record<string, unknown>).verification_token,
        );
        opts.notionWebhook?.onVerificationToken?.(token);
        return jsonResponse({ ok: true, verification_token: token }, 200);
      }

      const secret = opts.notionWebhook?.secret ?? adapter.notionWebhookSecret;
      if (!secret) {
        return jsonResponse(
          { ok: false, reason: "notion webhook secret not configured" },
          503,
        );
      }
      const signature = req.headers.get("X-Notion-Signature") ?? "";
      const expected = `sha256=${await hmacSha256Hex(secret, raw)}`;
      if (!timingSafeEqual(signature, expected)) {
        return jsonResponse(
          { ok: false, code: "webhook/signature_invalid" },
          401,
        );
      }

      const entity = (payload as { entity?: { id?: string; type?: string } })
        .entity;
      const pageId = entity?.type === "page" ? entity.id : undefined;
      if (!pageId) {
        return jsonResponse({ ok: true, skipped: "no page entity" }, 200);
      }

      const doWarm = async () => {
        const result = await adapter.warmByPageId(pageId);
        if (result) {
          adapter.logger?.info?.("notion webhook: キャッシュ更新完了", {
            operation: "notionWebhook",
            pageId,
            collection: result.collection,
            slug: result.slug,
          });
        }
        return result;
      };

      // 応答は即返し、ウォームは可能なら waitUntil でバックグラウンド完走させる。
      if (adapter.scheduleBackground) {
        adapter.scheduleBackground(doWarm());
        return jsonResponse({ ok: true, pageId }, 200);
      }
      const result = await doWarm();
      return jsonResponse({ ok: true, pageId, result }, 200);
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
