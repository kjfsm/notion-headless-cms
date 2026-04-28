import { makeCms } from "../lib/cms";
import type { Route } from "./+types/api.post.$slug";

export async function loader({ params, context }: Route.LoaderArgs) {
	const cms = makeCms(context.cloudflare.env);
	const post = await cms.posts.get(params.slug ?? "");
	if (!post) return Response.json(null, { status: 404 });
	const html = await post.render();
	return Response.json({ html, item: post });
}
