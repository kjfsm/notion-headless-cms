import {
  createCMS,
  createNodeSyncScheduler,
  memoryBlobStore,
  memoryDocStore,
} from "@notion-headless-cms/cms";
import { schema } from "@/app/schema";

export const cms = createCMS({
  schema,
  notion: { token: process.env.NOTION_TOKEN ?? "" },
  stores: { docs: memoryDocStore(), blobs: memoryBlobStore() },
  scheduler: createNodeSyncScheduler(),
  webhookSecret: process.env.REVALIDATE_SECRET,
});

/**
 * Vercel の serverless/edge 関数はインスタンス間でメモリを共有しないため、
 * in-memory store は永続しない（コールドスタートのたびに再同期が必要）。
 * KV/R2 相当の永続ストレージを使う場合は Vercel KV/Blob 向けの DocStore/BlobStore
 * 実装に差し替えること（Cloudflare 版は examples/cloudflare-* を参照）。
 */
let syncing: Promise<void> | null = null;

export async function ensureSynced(): Promise<void> {
  if (!syncing) {
    syncing = (async () => {
      let state = await cms.sync.getState();
      do {
        await cms.sync.kick();
        state = await cms.sync.getState();
      } while (state.cursor !== null);
    })();
  }
  await syncing;
}
