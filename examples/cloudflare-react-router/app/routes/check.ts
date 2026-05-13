import { makeCms } from "../lib/cms";
import type { Route } from "./+types/check";

export async function loader({ params, context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env);
  const version = await cms.posts.peekVersion(params.slug ?? "");
  return Response.json(version);
}
