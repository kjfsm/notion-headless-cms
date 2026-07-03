import { makeCms } from "../lib/cms";
import type { Route } from "./+types/warm";

/**
 * `SyncCoordinatorDO` は alarm 発火のたびに `chunkSize` 件ずつ自動で同期を進める
 * （Cloudflare Free プランのサブリクエスト上限を超えないよう、1 回の呼び出しを
 * 小さく保つ設計）。初回デプロイ直後など、alarm を待たずに今すぐ進めたい場合は
 * このエンドポイントを繰り返し叩く（`state.cursor` が `null` になるまで）。
 */
export async function action({ context }: Route.ActionArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  await cms.sync.kick();
  const state = await cms.sync.getState();
  return Response.json({ state });
}
