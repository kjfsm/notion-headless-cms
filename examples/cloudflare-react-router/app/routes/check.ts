import { makeCms } from "../lib/cms";
import type { Route } from "./+types/check";

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const slug = params.slug ?? "";
  const clientVersion = new URL(request.url).searchParams.get("v") ?? "";

  const cms = makeCms(context.cloudflare.env);
  const result = await cms.posts.check(slug, clientVersion);

  if (result === null) return new Response("Not Found", { status: 404 });
  if (!result.stale) return Response.json({ stale: false });

  const html = await result.item.html();
  return Response.json({
    stale: true,
    html,
    version: result.item.updatedAt,
  });
}
