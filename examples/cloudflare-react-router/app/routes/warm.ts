import { ensureSynced, makeCms } from "../lib/cms";
import type { Route } from "./+types/warm";

/**
 * 同期カーソルは isolate ローカルな in-memory 状態なので、デプロイ直後など
 * cold isolate に対して今すぐ全件同期を完了させたい場合にこのエンドポイントを叩く。
 */
export async function action({ context }: Route.ActionArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  await ensureSynced(cms);
  const state = await cms.sync.getState();
  return Response.json({ state });
}
