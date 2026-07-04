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
import { schema } from "../schema.js";
import type { Env } from "./cms.js";

/**
 * Notion アクセスを直列化する Durable Object。`wrangler.toml` の
 * `durable_objects.bindings` で `SyncCoordinatorDO` として binding する
 * （`src/index.ts` から re-export し、Worker のエントリに含める必要がある）。
 *
 * DO インスタンスは alarm 発火の間にエビクトされ得るため、`createCMS` は
 * DO の constructor で毎回呼び直す設計（`createSyncCoordinatorDO` 参照）。
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
    }),
});
