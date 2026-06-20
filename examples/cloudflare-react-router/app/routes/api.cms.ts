import { makeCms } from "../lib/cms";
import type { Route } from "./+types/api.cms";

// ライブラリ提供の HTTP ハンドラを 1 ファイルで mount する。
// 画像プロキシ(/api/cms/images/:hash)・更新検知(POST /api/cms/check/:collection/:slug?v=)・
// Webhook revalidate(/api/cms/revalidate/:collection) をまとめて処理する。
export async function loader({ request, context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  return cms.handler()(request);
}

export async function action({ request, context }: Route.ActionArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  return cms.handler()(request);
}
