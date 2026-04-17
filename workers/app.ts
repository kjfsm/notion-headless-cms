import { Hono } from "hono";
import { createRequestHandler } from "react-router";
import { getCMS } from "./cms";

const app = new Hono<{ Bindings: Env }>();

// 画像プロキシ: Notionの画像をR2から永続キャッシュとして配信する
app.get("/api/images/:key", async (c) => {
	const cms = getCMS(c.env);
	const key = c.req.param("key");
	const response = await cms.createCachedImageResponse(key);
	if (!response) return c.text("Not Found", 404);
	return response;
});

// 記事詳細の更新確認: Notionの最終更新時刻を比較し、変更があればHTML再生成して返す
// ただし「編集中」ステータスの記事はキャッシュを更新しない（公開済みに戻るまで変更を反映しない）
app.get("/api/posts/:slug/check", async (c) => {
	const cms = getCMS(c.env);
	if (!c.env.CACHE_BUCKET) {
		return c.json({ changed: false });
	}

	const slug = c.req.param("slug");
	const lastEdited = c.req.query("lastEdited") ?? "";
	return c.json(await cms.checkItemUpdate(c.env, slug, lastEdited));
});

// 記事一覧の更新確認: バージョン文字列を比較し、変更があれば最新リストを返す
app.get("/api/posts/check", async (c) => {
	const cms = getCMS(c.env);
	if (!c.env.CACHE_BUCKET) {
		return c.json({ changed: false });
	}

	const clientVersion = c.req.query("version") ?? "";
	return c.json(await cms.checkItemsUpdate(c.env, clientVersion));
});

app.get("*", (c) => {
	const requestHandler = createRequestHandler(
		() => import("virtual:react-router/server-build"),
		import.meta.env.MODE,
	);

	return requestHandler(c.req.raw, {
		cloudflare: { env: c.env, ctx: c.executionCtx },
	});
});

export default app;
