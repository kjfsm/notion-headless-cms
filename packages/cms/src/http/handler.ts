import type { BlobStore } from "../store/types.js";
import type { Logger } from "../types/logger.js";
import { verifyNotionSignature } from "./webhook.js";

export interface HttpHandlerOptions {
  /** マウントするベースパス(例 `/api/cms`)。 */
  readonly routes: string;
  readonly imagesPath?: string;
  readonly webhookPath?: string;
  readonly realtimePath?: string;
  readonly previewPath?: string;
  readonly ogpPath?: string;
}

const DEFAULTS = {
  imagesPath: "/images",
  webhookPath: "/webhook",
  realtimePath: "/realtime",
  previewPath: "/preview",
  ogpPath: "/ogp",
} as const;

export interface HttpHandlerAdapter {
  /** 画像バイナリの読み出し元(`image/{hash}` キーで保存されている前提)。 */
  readonly images: BlobStore;
  readonly webhookSecret?: string;
  /** サブスク登録時の `verification_token` 受信コールバック。 */
  onVerificationToken?(token: string): void;
  /** 署名検証済み webhook イベントのハンドラ(SyncCoordinator.onWebhook への委譲を想定)。 */
  onWebhookEvent?(pageId: string): Promise<void> | void;
  /** WebSocket アップグレードの委譲先(RealtimeHub DO への転送を想定)。 */
  onRealtimeUpgrade?(request: Request): Promise<Response> | Response;
  /** 署名付きプレビューの委譲先(#444 で実装)。 */
  onPreview?(request: Request, rel: string): Promise<Response> | Response;
  /**
   * OGP エンドポイント(`GET {routes}/ogp?url=...`)の委譲先。
   * `createOgpHandler()` の戻り値をそのまま渡す想定（ページアクセス時に fetch する）。
   */
  onOgp?(request: Request): Promise<Response> | Response;
  /** レスポンス送信後もバックグラウンド処理を完走させるフック(Workers の `waitUntil` 相当)。 */
  waitUntil?(p: Promise<unknown>): void;
  readonly logger?: Logger;
}

function imageKey(hash: string): string {
  return `image/${hash}`;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * `routes` 1 箇所の宣言から images / webhook / realtime / preview をすべて導出する
 * 統合ハンドラ(#443)。v2 で 4 系統に分かれていた手動配線を解消する。
 */
export function createFetchHandler(
  adapter: HttpHandlerAdapter,
  opts: HttpHandlerOptions,
): (request: Request) => Promise<Response> {
  const routes = opts.routes.endsWith("/") ? opts.routes.slice(0, -1) : opts.routes;
  const imagesPath = opts.imagesPath ?? DEFAULTS.imagesPath;
  const webhookPath = opts.webhookPath ?? DEFAULTS.webhookPath;
  const realtimePath = opts.realtimePath ?? DEFAULTS.realtimePath;
  const previewPath = opts.previewPath ?? DEFAULTS.previewPath;
  const ogpPath = opts.ogpPath ?? DEFAULTS.ogpPath;

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(routes)) {
      return new Response("Not Found", { status: 404 });
    }
    const rel = url.pathname.slice(routes.length) || "/";

    if (request.method === "GET" && rel.startsWith(`${imagesPath}/`)) {
      const hash = rel.slice(imagesPath.length + 1);
      if (!hash) return new Response("Bad Request", { status: 400 });
      // getWithMetadata があれば本体と content-type を 1 回の読み取りで済ませる
      // (R2 の get+head 2 オペレーションを 1 回に抑える)。無い実装のみ get+head。
      const stored = adapter.images.getWithMetadata
        ? await adapter.images.getWithMetadata(imageKey(hash))
        : await (async () => {
            const bytes = await adapter.images.get(imageKey(hash));
            if (!bytes) return null;
            const head = await adapter.images.head(imageKey(hash));
            return { bytes, contentType: head?.contentType };
          })();
      if (!stored) {
        adapter.logger?.warn?.("画像が見つかりません", {
          operation: "images",
          status: 404,
        });
        return new Response("Not Found", { status: 404 });
      }
      const headers = new Headers({
        "cache-control": "public, max-age=31536000, immutable",
      });
      if (stored.contentType) headers.set("content-type", stored.contentType);
      return new Response(stored.bytes as BodyInit, { headers });
    }

    if (request.method === "GET" && (rel === realtimePath || rel.startsWith(`${realtimePath}/`))) {
      if (adapter.onRealtimeUpgrade) return adapter.onRealtimeUpgrade(request);
      return new Response("Not Found", { status: 404 });
    }

    if (rel.startsWith(`${previewPath}/`)) {
      if (adapter.onPreview) return adapter.onPreview(request, rel.slice(previewPath.length + 1));
      return new Response("Not Found", { status: 404 });
    }

    if (request.method === "GET" && rel === ogpPath) {
      if (adapter.onOgp) return adapter.onOgp(request);
      return new Response("Not Found", { status: 404 });
    }

    if (request.method === "POST" && rel === webhookPath) {
      const raw = await request.text();
      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        return jsonResponse({ ok: false, reason: "invalid json" }, 400);
      }

      if (payload && typeof payload === "object" && "verification_token" in payload) {
        const token = String((payload as Record<string, unknown>).verification_token);
        adapter.onVerificationToken?.(token);
        return jsonResponse({ ok: true, verification_token: token }, 200);
      }

      if (!adapter.webhookSecret) {
        return jsonResponse({ ok: false, reason: "webhook secret not configured" }, 503);
      }
      const signature = request.headers.get("X-Notion-Signature");
      const valid = await verifyNotionSignature(adapter.webhookSecret, raw, signature);
      if (!valid) {
        adapter.logger?.warn?.("webhook 署名が不正です", {
          operation: "webhook",
          status: 401,
        });
        return jsonResponse({ ok: false, code: "handler/signature_invalid" }, 401);
      }

      const entity = (payload as { entity?: { id?: string; type?: string } }).entity;
      const pageId = entity?.type === "page" ? entity.id : undefined;
      if (!pageId) {
        return jsonResponse({ ok: true, skipped: "no page entity" }, 200);
      }

      adapter.logger?.info?.("webhook を受信しました", {
        operation: "webhook",
        pageId,
      });

      const run = Promise.resolve(adapter.onWebhookEvent?.(pageId));
      if (adapter.waitUntil) {
        adapter.waitUntil(run);
        return jsonResponse({ ok: true, pageId }, 200);
      }
      await run;
      return jsonResponse({ ok: true, pageId }, 200);
    }

    return new Response("Not Found", { status: 404 });
  };
}
