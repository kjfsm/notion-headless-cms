import type { DurableObjectStateLike } from "@notion-headless-cms/cms";
import {
  createCMS,
  createDurableObjectSyncScheduler,
} from "@notion-headless-cms/cms";
import {
  createSyncCoordinatorDO,
  kvDocStore,
  r2BlobStore,
} from "@notion-headless-cms/cms/cloudflare";
import { schema } from "../app/schema";

/**
 * Notion API アクセスを直列化する同期コーディネータ。実際に Notion 同期を実行する
 * のはこのインスタンスだけで、reader 側の `getCMS()` は `syncDelegate` 経由でこの
 * DO に委譲する（KV/R2 の読み取りのみ、Notion へは一切アクセスしない）。
 */
export const SyncCoordinatorDO = createSyncCoordinatorDO<Env>({
  createCMS: (state: DurableObjectStateLike, env: Env) =>
    createCMS({
      schema,
      notion: { token: env.NOTION_TOKEN },
      stores: {
        docs: kvDocStore(env.DOC_CACHE),
        blobs: r2BlobStore(env.IMG_BUCKET),
      },
      scheduler: createDurableObjectSyncScheduler(state),
      // ブロック内の画像URLは同期時にここで焼き込まれる。reader 側 cms.fetch() は
      // routes(既定 /api/cms)+imagesPath(既定 /images) を結合して配信するため、
      // 焼き込み側は配信URLと一致する絶対パスを明示する必要がある。
      imagesPath: "/api/cms/images",
    }),
});
