import { makeCms } from "../lib/cms";
import { cloudflareContext } from "../lib/context";
import type { Route } from "./+types/api.cms";

// 画像プロキシ(/api/cms/images/:hash)・Webhook(/api/cms/webhook) をまとめて
// cms.fetch() 1 つで配信する。
export async function loader({ request, context }: Route.LoaderArgs) {
  const { env, ctx } = context.get(cloudflareContext);
  return makeCms(env, ctx).fetch(request);
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env, ctx } = context.get(cloudflareContext);
  return makeCms(env, ctx).fetch(request);
}
