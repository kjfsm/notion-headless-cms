import { ensureSynced, makeCms } from "../lib/cms";
import { cloudflareContext } from "../lib/context";
import type { Route } from "./+types/warm";

/**
 * 同期カーソルは isolate ローカルな in-memory 状態なので、デプロイ直後など
 * cold isolate に対して今すぐ全件同期を完了させたい場合にこのエンドポイントを叩く。
 */
export async function action({ context }: Route.ActionArgs) {
  const { env, ctx } = context.get(cloudflareContext);
  const cms = makeCms(env, ctx);
  await ensureSynced(cms);
  const state = await cms.sync.getState();
  return Response.json({ state });
}
