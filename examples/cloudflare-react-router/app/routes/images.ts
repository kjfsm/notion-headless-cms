import { makeCms } from "../lib/cms";
import type { Route } from "./+types/images";

export async function loader({ params, context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env);
  const object = await cms.$getCachedImage(params.hash ?? "");
  if (!object) return new Response("Not Found", { status: 404 });
  const headers = new Headers();
  if (object.contentType) headers.set("content-type", object.contentType);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.data, { headers });
}
