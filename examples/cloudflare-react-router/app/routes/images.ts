import { createCMS } from "../lib/cms";
import type { Route } from "./+types/images";

export async function loader({ params, context }: Route.LoaderArgs) {
	const cms = createCMS(context.cloudflare.env);
	const response = await cms.createCachedImageResponse(params.hash ?? "");
	return response ?? new Response("Not Found", { status: 404 });
}
