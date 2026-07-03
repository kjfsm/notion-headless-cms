import { makeCms } from "../lib/cms";
import type { Route } from "./+types/api.cms";

// 画像プロキシ(/api/cms/images/:hash)・Webhook(/api/cms/webhook) をまとめて
// cms.fetch() 1 つで配信する。
export async function loader({ request, context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  return cms.fetch(request);
}

export async function action({ request, context }: Route.ActionArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  return cms.fetch(request);
}
