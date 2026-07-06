import { createCMS } from "@notion-headless-cms/cms";
import { durableObjectSyncDelegate, r2BlobStore } from "@notion-headless-cms/cms/cloudflare";
import { d1IndexStore } from "@notion-headless-cms/sql/d1";

import { schema } from "../schema";

/**
 * 読者用の stateless CMS インスタンス。D1/R2 の読み取り（`find`/`list`/`search`）はここで直接行い、
 * Notion API への直列アクセスは `SyncCoordinatorDO`（`workers/sync-coordinator-do.ts`）に
 * 一元化する（`syncDelegate` 経由で転送する）。
 */
export function makeCms(env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
  return createCMS({
    schema,
    stores: {
      index: d1IndexStore(env.DB, schema),
      blobs: r2BlobStore(env.IMG_BUCKET),
    },
    syncDelegate: durableObjectSyncDelegate({
      namespace: env.SYNC_COORDINATOR,
    }),
    webhookSecret: env.NOTION_WEBHOOK_SECRET,
    waitUntil: (p: Promise<unknown>) => ctx.waitUntil(p),
  });
}
