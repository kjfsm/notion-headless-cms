import {
  createCMS,
  createNodeSyncScheduler,
  memoryBlobStore,
  memoryIndexStore,
} from "@notion-headless-cms/cms";

import { schema } from "@/app/schema";

/**
 * Vercel の serverless/edge 関数はインスタンス間でメモリを共有しないため、
 * in-memory store は永続しない（コールドスタートのたびに再同期が必要）。
 * D1/R2 相当の永続ストレージを使う場合は libSQL(Turso)/Vercel Blob 向けの
 * IndexStore/BlobStore 実装に差し替えること（Cloudflare 版は examples/cloudflare-* を参照）。
 */
type Cms = ReturnType<typeof createCMS<typeof schema>>;

let instance: Cms | undefined;

/**
 * `next build` はページ/ルートハンドラの静的解析のためモジュールを import する
 * （実行はしない）。トップレベルで `createCMS()` を呼ぶと、`NOTION_TOKEN` が
 * 無いビルド環境（CI 等）でその import だけでビルドが失敗する。
 * 構築を実際に使う時点まで遅延することでこれを避ける。
 */
export function getCms(): Cms {
  if (!instance) {
    instance = createCMS({
      schema,
      notion: { token: process.env.NOTION_TOKEN ?? "" },
      stores: { index: memoryIndexStore(), blobs: memoryBlobStore() },
      scheduler: createNodeSyncScheduler(),
      webhookSecret: process.env.REVALIDATE_SECRET,
    });
  }
  return instance;
}

let syncing: Promise<void> | null = null;

export async function ensureSynced(): Promise<Cms> {
  const cms = getCms();
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
  return cms;
}
