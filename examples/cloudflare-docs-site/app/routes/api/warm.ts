import { makeCms } from "../../lib/cms";
import type { Route } from "./+types/warm";

export async function action({ context }: Route.ActionArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  const result = await cms.docs.cache.warm({
    onProgress: (done: number, total: number) =>
      console.log(`[warm] ${done}/${total}`),
  });
  return Response.json(result);
}
