import { makeCms } from "../../../../lib/cms";
import type { Route } from "./+types/check";

export async function loader({ params, context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  const version = await cms.docs.peekVersion(params.slug ?? "");
  return Response.json(version);
}
