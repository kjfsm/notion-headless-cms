import type { CMSClient, DataSourceMap } from "@notion-headless-cms/core";

export interface RevalidateHandlerOptions {
	/** Webhook 検証用シークレット。Authorization ヘッダと照合する。 */
	secret: string;
}

/**
 * `/app/api/images/[hash]/route.ts` 用の Next.js ルートハンドラを生成する。
 * 内部的に `cms.$handler()` の画像プロキシ部分を抽出。
 *
 * @example
 * // app/api/images/[hash]/route.ts
 * import { cms } from "@/lib/cms";
 * import { createImageRouteHandler } from "@notion-headless-cms/adapter-next";
 * export const GET = createImageRouteHandler(cms);
 */
export function createImageRouteHandler<D extends DataSourceMap>(
	cms: CMSClient<D>,
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
 * Revalidate Webhook 用の Next.js ルートハンドラを生成する。
 * Authorization ヘッダで secret を検証し、`cms.$revalidate()` を呼ぶ。
 *
 * @example
 * // app/api/revalidate/route.ts
 * import { cms } from "@/lib/cms";
 * import { createRevalidateRouteHandler } from "@notion-headless-cms/adapter-next";
 * export const POST = createRevalidateRouteHandler(cms, { secret: process.env.REVALIDATE_SECRET! });
 */
export function createRevalidateRouteHandler<D extends DataSourceMap>(
	cms: CMSClient<D>,
	opts: RevalidateHandlerOptions,
): (request: Request) => Promise<Response> {
	return async (request) => {
		const auth = request.headers.get("authorization");
		if (auth !== `Bearer ${opts.secret}`) {
			return new Response("Unauthorized", { status: 401 });
		}

		let payload:
			| { collection?: string; slug?: string; all?: boolean }
			| undefined;
		try {
			payload = await request.json();
		} catch {
			// JSON でなくても動作する
		}

		if (!payload || payload.all) {
			await cms.$revalidate("all");
			return Response.json({ ok: true, scope: "all" });
		}
		if (payload.collection && payload.slug) {
			await cms.$revalidate({
				collection: payload.collection,
				slug: payload.slug,
			});
			return Response.json({ ok: true, scope: payload });
		}
		if (payload.collection) {
			await cms.$revalidate({ collection: payload.collection });
			return Response.json({ ok: true, scope: payload });
		}

		await cms.$revalidate("all");
		return Response.json({ ok: true, scope: "all" });
	};
}
