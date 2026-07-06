import { createCMS } from "@notion-headless-cms/cms";
import {
  durableObjectSyncDelegate,
  kvDocStore,
  r2BlobStore,
} from "@notion-headless-cms/cms/cloudflare";

import { schema } from "../schema.js";

export interface Env {
  readonly NOTION_TOKEN: string;
  readonly DOC_CACHE: KVNamespace;
  readonly IMG_BUCKET: R2Bucket;
  readonly SYNC_COORDINATOR: DurableObjectNamespace;
}

/**
 * 読者用の stateless Worker 側インスタンス。KV/R2 の読み取り（`find`/`list`）は
 * ここで直接行い、Notion API への直列アクセスは `SyncCoordinatorDO`
 * （`src/lib/do.ts`）に一元化する（`syncDelegate` 経由で転送する）。
 */
export function makeCms(env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
  const id = env.SYNC_COORDINATOR.idFromName("global");
  const stub = env.SYNC_COORDINATOR.get(id);
  return createCMS({
    schema,
    stores: {
      docs: kvDocStore(env.DOC_CACHE),
      blobs: r2BlobStore(env.IMG_BUCKET),
    },
    syncDelegate: durableObjectSyncDelegate({ stub }),
    waitUntil: (p: Promise<unknown>) => ctx.waitUntil(p),
  });
}
