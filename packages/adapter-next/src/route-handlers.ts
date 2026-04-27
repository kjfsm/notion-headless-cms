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
 * Revalidate Webhook 用の Next.js ルートハンドラを生成する。
 * Authorization ヘッダで secret を検証し、`cms.$invalidate()` を呼ぶ。
 *
 * @example
 * // app/api/revalidate/route.ts
 * import { cms } from "@/lib/cms";
 * import { createRevalidateRouteHandler } from "@notion-headless-cms/adapter-next";
 * export const POST = createRevalidateRouteHandler(cms, { secret: process.env.REVALIDATE_SECRET! });
 */
export function createRevalidateRouteHandler(
	cms: CMSGlobalOps,
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

		const scope: InvalidateScope =
			!payload || payload.all
				? "all"
				: payload.collection && payload.slug
					? { collection: payload.collection, slug: payload.slug }
					: payload.collection
						? { collection: payload.collection }
						: "all";

		await cms.$invalidate(scope);
		return Response.json({
			ok: true,
			scope: scope === "all" ? "all" : payload,
		});
	};
}
