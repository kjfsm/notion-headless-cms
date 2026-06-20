import { makeCms } from "../../../../lib/cms";
import type { Route } from "./+types/check";

// クライアント側の <NotionRevalidator> が mount / 再フォーカス時に叩く更新検知エンドポイント。
// `?v=<version>` に現在表示中の lastEditedTime を載せて POST すると、サーバーが Notion と
// 突合し `{ stale, version }` を返す。stale:true のときだけクライアントが revalidate する。
export async function action({ params, request, context }: Route.ActionArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  const url = new URL(request.url);
  const version = url.searchParams.get("v") ?? "";
  const result = await cms.pages.check(params.slug ?? "", version);
  if (result === null) return Response.json(null, { status: 404 });
  return Response.json({
    stale: result.stale,
    version: result.stale ? result.item.lastEditedTime : version,
  });
}
