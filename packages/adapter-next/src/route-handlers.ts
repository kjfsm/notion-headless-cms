import type { CMS } from "@notion-headless-cms/core";

export interface RevalidateHandlerOptions {
	/** Webhook 検証用シークレット。Authorization ヘッダと照合する。 */
	secret: string;
}

/**
 * `/app/api/images/[hash]/route.ts` 用の Next.js ルートハンドラを生成する。
 *
 * @example
 * // app/api/images/[hash]/route.ts
 * import { cms } from "@/lib/cms";
 * import { createImageRouteHandler } from "@notion-headless-cms/adapter-next";
 * export const GET = createImageRouteHandler(cms);
 */
export function createImageRouteHandler(
	cms: CMS,
): (
	request: Request,
	context: { params: Promise<{ hash: string }> },
) => Promise<Response> {
	return async (_request, context) => {
		const { hash } = await context.params;
		const response = await cms.createCachedImageResponse(hash);
		if (!response) {
			return new Response("Not Found", { status: 404 });
		}
		return response;
	};
}

/**
 * Revalidate Webhook 用の Next.js ルートハンドラを生成する。
 * Authorization ヘッダで secret を検証し、cms.syncFromWebhook() を呼ぶ。
 *
 * @example
 * // app/api/revalidate/route.ts
 * import { cms } from "@/lib/cms";
 * import { createRevalidateRouteHandler } from "@notion-headless-cms/adapter-next";
 * export const POST = createRevalidateRouteHandler(cms, { secret: process.env.REVALIDATE_SECRET! });
 */
export function createRevalidateRouteHandler(
	cms: CMS,
	opts: RevalidateHandlerOptions,
): (request: Request) => Promise<Response> {
	return async (request) => {
		const auth = request.headers.get("authorization");
		if (auth !== `Bearer ${opts.secret}`) {
			return new Response("Unauthorized", { status: 401 });
		}

		let payload: { slug?: string } | undefined;
		try {
			payload = await request.json();
		} catch {
			// JSON でなくても動作する
		}

		const result = await cms.cache.sync(payload);
		return Response.json({ updated: result.updated });
	};
}
