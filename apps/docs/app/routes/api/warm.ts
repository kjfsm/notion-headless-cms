import { makeCms } from "../../lib/cms";
import type { Route } from "./+types/warm";

// 起動直後やデプロイ後に明示的にキャッシュを温める。pages コレクション（Notion 配信分）のみが対象。
// md docs はビルド時に静的バンドルされるため warm-up 不要。
export async function action({ context }: Route.ActionArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  const result = await cms.pages.cache.warm({
    onProgress: (done: number, total: number) =>
      console.log(`[warm] ${done}/${total}`),
  });
  return Response.json(result);
}
