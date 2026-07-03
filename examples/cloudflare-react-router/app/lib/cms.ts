import { createCMS } from "@notion-headless-cms/cms";
import {
  durableObjectRealtime,
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
  readonly REALTIME_HUB: DurableObjectNamespace;
}

/**
 * 読者用の stateless Worker 側インスタンス。KV/R2 の読み取り（`find`/`list`）は
 * ここで直接行い、Notion API への直列アクセスは `SyncCoordinatorDO`
 * （`app/lib/do.ts`）に一元化する（`syncDelegate` 経由で転送する）。
 * 更新通知は `RealtimeHubDO` 経由で push し、`onRealtimeUpgrade` で
 * `/api/cms/realtime` への WebSocket アップグレードを DO へ橋渡しする。
 */
export function makeCms(
  env: Env,
  ctx: { waitUntil(p: Promise<unknown>): void },
) {
  const syncId = env.SYNC_COORDINATOR.idFromName("global");
  const syncStub = env.SYNC_COORDINATOR.get(syncId);
  return createCMS({
    schema,
    stores: {
      docs: kvDocStore(env.DOC_CACHE),
      blobs: r2BlobStore(env.IMG_BUCKET),
    },
    syncDelegate: durableObjectSyncDelegate({ stub: syncStub }),
    realtime: durableObjectRealtime({ namespace: env.REALTIME_HUB }),
    onRealtimeUpgrade: (request) => {
      const id = env.REALTIME_HUB.idFromName("global");
      return env.REALTIME_HUB.get(id).fetch(request);
    },
    waitUntil: (p: Promise<unknown>) => ctx.waitUntil(p),
  });
}
