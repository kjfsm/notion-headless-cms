import { makeCms } from "../../../lib/cms";
import type { Route } from "./+types/$";

// ライブラリが用意した HTTP ハンドラ（画像プロキシ・OGP・Webhook）を
// 1 ファイルで mount する。routes は createCMS の既定値 /api/cms。
export async function loader({ request, context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  return cms.fetch(request);
}

export async function action({ request, context }: Route.ActionArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  return cms.fetch(request);
}
