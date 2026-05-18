import { makeCms } from "../../../../lib/cms";
import type { Route } from "./+types/check";

// クライアント側の <NotionRevalidator> が一定間隔で叩く version check エンドポイント。
// Notion ページの lastEditedTime が手元のものと違えば再フェッチを発火する。
export async function loader({ params, context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  const version = await cms.pages.peekVersion(params.slug ?? "");
  return Response.json(version);
}
