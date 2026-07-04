import {
  createCMS,
  createNodeSyncScheduler,
  memoryBlobStore,
  memoryDocStore,
} from "@notion-headless-cms/cms";
import { schema } from "./schema.js";

const cms = createCMS({
  schema,
  notion: { token: process.env.NOTION_TOKEN ?? "" },
  stores: { docs: memoryDocStore(), blobs: memoryBlobStore() },
  scheduler: createNodeSyncScheduler(),
});

// kick() は 1 チャンク（既定 2 件）だけ処理する設計（Workers の chunked sync 用）。
// 一括スクリプトとして全件を確実に読者に反映するため、cursor が尽きるまで手動で回す。
let state = await cms.sync.getState();
do {
  await cms.sync.kick();
  state = await cms.sync.getState();
} while (state.cursor !== null);

const { items: posts } = await cms.posts.list();
console.log(`${posts.length} 件の記事を取得しました`);
for (const post of posts) {
  const meta = post.meta as { title?: string };
  console.log(`- ${post.slug}\t${meta.title ?? "(no title)"}`);
}
