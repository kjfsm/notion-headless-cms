import type { ImageCacheOps, InvalidateScope } from "./types/index";

/** `$handler()` の挙動設定。 */
export interface HandlerOptions {
	/** マウントするベースパス。デフォルト `/api/cms`。 */
	basePath?: string;
	/** 画像プロキシのパス (basePath 相対)。デフォルト `/images/:hash`。 */
	imagesPath?: string;
	/** revalidate webhook のパス (basePath 相対)。デフォルト `/revalidate`。 */
	revalidatePath?: string;
	/** Webhook 署名検証用シークレット (未指定なら検証スキップ)。 */
	webhookSecret?: string;
	/** デフォルト実装を無効化する場合 true。 */
	disabled?: boolean;
}

/** `$handler()` が内部で依存する CMS 機能の最小セット。 */
export interface HandlerAdapter {
	imageCache: ImageCacheOps;
	/** コレクション名で DataSource を取り出し parseWebhook にフォワードする。 */
	parseWebhook(
		req: Request,
		webhookSecret: string | undefined,
	): Promise<InvalidateScope | null>;
	revalidate(scope: InvalidateScope): Promise<void>;
}

const DEFAULT_OPTS = {
	basePath: "/api/cms",
	imagesPath: "/images",
	revalidatePath: "/revalidate",
} as const;

/**
 * Web Standard な Request → Response ルーター。
 * Next.js / React Router / Hono / Cloudflare Workers いずれでも使える。
 *
 * ルート:
 * - GET  `{basePath}/images/:hash` — 画像プロキシ
 * - POST `{basePath}/revalidate`   — Webhook 受信 + $revalidate()
 */
export function createHandler(
	adapter: HandlerAdapter,
	opts: HandlerOptions = {},
): (req: Request) => Promise<Response> {
	const basePath = trimTrailingSlash(opts.basePath ?? DEFAULT_OPTS.basePath);
	const imagesPath = opts.imagesPath ?? DEFAULT_OPTS.imagesPath;
	const revalidatePath = opts.revalidatePath ?? DEFAULT_OPTS.revalidatePath;

	return async (req: Request): Promise<Response> => {
		const url = new URL(req.url);
		const path = url.pathname;

		if (!path.startsWith(basePath)) {
			return new Response("Not Found", { status: 404 });
		}
		const rel = path.slice(basePath.length) || "/";

		// 画像: GET {basePath}/images/:hash
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

		// Revalidate: POST {basePath}/revalidate
		if (req.method === "POST" && rel === revalidatePath) {
			const scope = await adapter.parseWebhook(req, opts.webhookSecret);
			if (!scope) {
				return new Response(JSON.stringify({ ok: false, reason: "invalid" }), {
					status: 400,
					headers: { "content-type": "application/json" },
				});
			}
			await adapter.revalidate(scope);
			return new Response(JSON.stringify({ ok: true, scope }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}

		return new Response("Not Found", { status: 404 });
	};
}

function trimTrailingSlash(s: string): string {
	return s.endsWith("/") ? s.slice(0, -1) : s;
}
