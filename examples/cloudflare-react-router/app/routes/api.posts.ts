import { makeCms } from "../lib/cms";
import type { Route } from "./+types/api.posts";

export async function loader({ context }: Route.LoaderArgs) {
	const cms = makeCms(context.cloudflare.env);
	const items = await cms.posts.list();
	return Response.json(items);
}
