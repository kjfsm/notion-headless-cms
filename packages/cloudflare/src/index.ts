import type {
  CloudflareExecutionContextLike,
  CloudflarePresetEnv,
} from "@notion-headless-cms/cache/cloudflare";
import { cloudflarePreset } from "@notion-headless-cms/cache/cloudflare";

export type { RestKvOptions } from "./rest-kv";
export { restKvNamespace } from "./rest-kv";

import { createClient } from "@notion-headless-cms/core";
import type {
  NotionPublishOptions,
  NotionSourceConfig,
  SchemaMap,
} from "@notion-headless-cms/notion-source";
import { notionSource } from "@notion-headless-cms/notion-source";

export type {
  CloudflareExecutionContextLike,
  CloudflarePresetEnv,
  CloudflarePresetOptions,
  CloudflarePresetTestOptions,
} from "@notion-headless-cms/cache/cloudflare";
export { cloudflarePreset } from "@notion-headless-cms/cache/cloudflare";
export type { CMSClient, CMSGlobalOps } from "@notion-headless-cms/core";
export {
  CMSError,
  createClient,
  isCMSError,
  nodePreset,
} from "@notion-headless-cms/core";
export type {
  NotionPublishOptions,
  NotionSourceConfig,
} from "@notion-headless-cms/notion-source";
export { notionSource } from "@notion-headless-cms/notion-source";

/**
 * `createCms()` に渡すオプション（Cloudflare Workers 向け）。
 * @deprecated v1.0.0 で削除予定。`CreateClientOptions` を直接使ってください。
 * 詳細は `docs/ja/migration/createCms-to-createClient.md`。
 */
export interface CreateCmsOptions<S extends SchemaMap>
  extends Pick<NotionSourceConfig<S>, "fetch"> {
  schema: S;
  token: string;
  publishOptions?: { [K in keyof S]?: NotionPublishOptions };
  /** Cloudflare env binding（KV / R2 用）。 */
  env: CloudflarePresetEnv;
  /** Cloudflare ExecutionContext（SWR バックグラウンド更新に必要）。 */
  ctx: CloudflareExecutionContextLike;
}

/**
 * Cloudflare Workers 向け高レベル API。`notionSource` + `cloudflarePreset` + `createClient` をまとめて呼ぶ。
 *
 * @deprecated v1.0.0 で削除予定 (Issue #312 / M1)。`createClient` を直接使ってください。
 * 詳細は `docs/ja/migration/createCms-to-createClient.md`。
 *
 * @example 推奨される置き換え
 * ```ts
 * import { createClient, cloudflarePreset, notionSource } from "@notion-headless-cms/cloudflare";
 * import { schema } from "./generated/nhc";
 *
 * export default {
 *   async fetch(req: Request, env: Env, ctx: ExecutionContext) {
 *     const cms = createClient({
 *       sources: { notion: notionSource({ schema, token: env.NOTION_TOKEN }) },
 *       ...cloudflarePreset({ env, ctx }),
 *     });
 *   },
 * };
 * ```
 */
export function createCms<S extends SchemaMap>(opts: CreateCmsOptions<S>) {
  return createClient({
    sources: {
      notion: notionSource({
        schema: opts.schema,
        token: opts.token,
        ...(opts.fetch ? { fetch: opts.fetch } : {}),
        publishOptions: opts.publishOptions,
      }),
    },
    ...cloudflarePreset({ env: opts.env, ctx: opts.ctx }),
  });
}
