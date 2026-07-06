import {
  createCMS,
  createNodeSyncScheduler,
  memoryBlobStore,
  memoryIndexStore,
} from "@notion-headless-cms/cms";

import { schema } from "../schema.js";

const token = process.env.NOTION_TOKEN;
if (!token) {
  throw new Error("NOTION_TOKEN env が設定されていません。");
}

export const cms = createCMS({
  schema,
  notion: { token },
  stores: { index: memoryIndexStore(), blobs: memoryBlobStore() },
  scheduler: createNodeSyncScheduler(),
  routes: "/api/cms",
});

/**
 * kick() は 1 チャンク（既定 2 件）だけ処理する設計（Workers の chunked sync 用）。
 * サーバ起動時に全件を確実に反映するため、cursor が尽きるまで手動で回す
 * （起動後は webhook 経由の差分同期に任せる）。
 */
export async function syncAll(): Promise<void> {
  let state = await cms.sync.getState();
  do {
    await cms.sync.kick();
    state = await cms.sync.getState();
  } while (state.cursor !== null);
}
