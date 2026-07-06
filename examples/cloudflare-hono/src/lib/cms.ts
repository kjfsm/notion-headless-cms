import { createCMS } from "@notion-headless-cms/cms";
import { durableObjectSyncDelegate, r2BlobStore } from "@notion-headless-cms/cms/cloudflare";
import { d1IndexStore } from "@notion-headless-cms/sql/d1";

import { schema } from "../schema.js";

export interface Env {
  readonly NOTION_TOKEN: string;
  readonly DB: D1Database;
  readonly IMG_BUCKET: R2Bucket;
  readonly SYNC_COORDINATOR: DurableObjectNamespace;
}

/**
 * 読者用の stateless Worker 側インスタンス。D1/R2 の読み取り（`find`/`list`/`search`）は
 * ここで直接行い、Notion API への直列アクセスは `SyncCoordinatorDO`
 * （`src/lib/do.ts`）に一元化する（`syncDelegate` 経由で転送する）。
 */
export function makeCms(env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
  const id = env.SYNC_COORDINATOR.idFromName("global");
  const stub = env.SYNC_COORDINATOR.get(id);
  return createCMS({
    schema,
    stores: {
      index: d1IndexStore(env.DB, schema),
      blobs: r2BlobStore(env.IMG_BUCKET),
    },
    syncDelegate: durableObjectSyncDelegate({ stub }),
    waitUntil: (p: Promise<unknown>) => ctx.waitUntil(p),
  });
}
