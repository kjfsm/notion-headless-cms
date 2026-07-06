import { createCMS, createNodeSyncScheduler } from "@notion-headless-cms/cms";
import { kvDocStore, r2BlobStore } from "@notion-headless-cms/cms/cloudflare";

import { schema } from "../schema.js";

export interface Env {
  readonly NOTION_TOKEN: string;
  readonly DOC_CACHE: KVNamespace;
  readonly IMG_BUCKET: R2Bucket;
}

/**
 * KV/R2 は永続化されるが、同期カーソル自体は Worker isolate 内の
 * `createNodeSyncScheduler()`（setTimeout ベース、Workers ランタイムでも動く）に
 * 保持するため isolate が入れ替わると失われる。差分クエリは既存 version と
 * 一致すれば打ち切るため、この場合の再同期は「再検証クエリ 1 回」で済み、
 * 変更の無いページを再マテリアライズすることはない。
 */
export function makeCms(env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
  return createCMS({
    schema,
    notion: { token: env.NOTION_TOKEN },
    stores: {
      docs: kvDocStore(env.DOC_CACHE),
      blobs: r2BlobStore(env.IMG_BUCKET),
    },
    scheduler: createNodeSyncScheduler(),
    waitUntil: (p: Promise<unknown>) => ctx.waitUntil(p),
  });
}

/**
 * cursor が尽きるまで kick をループする。差分が無ければ最初のチャンクで
 * `nextCursor: null` になり 1 回の軽い再検証クエリで終わる（scheduler の
 * cursor は isolate ごとの in-memory 状態のため、リクエストのたびに
 * cursor=null から再開する前提の設計）。
 */
export async function ensureSynced(cms: ReturnType<typeof makeCms>): Promise<void> {
  let state = await cms.sync.getState();
  do {
    await cms.sync.kick();
    state = await cms.sync.getState();
  } while (state.cursor !== null);
}
