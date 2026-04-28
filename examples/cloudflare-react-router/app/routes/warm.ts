import { makeCms } from "../lib/cms";
import type { Route } from "./+types/warm";

export async function action({ context }: Route.ActionArgs) {
  const cms = makeCms(context.cloudflare.env);
  const result = await cms.posts.cache.warm({
    onProgress: (done, total) => console.log(`[warm] ${done}/${total}`),
  });
  return Response.json(result);
}
