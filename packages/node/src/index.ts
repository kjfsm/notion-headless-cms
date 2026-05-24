import { createClient, nodePreset } from "@notion-headless-cms/core";
import type {
  NotionPublishOptions,
  NotionSourceConfig,
  SchemaMap,
} from "@notion-headless-cms/notion-source";
import { notionSource } from "@notion-headless-cms/notion-source";

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
 * `createCms()` に渡すオプション。
 * @deprecated v1.0.0 で削除予定。`CreateClientOptions` を直接使ってください。
 * 詳細は `docs/ja/migration/createCms-to-createClient.md`。
 */
export interface CreateCmsOptions<S extends SchemaMap>
  extends Pick<NotionSourceConfig<S>, "fetch"> {
  schema: S;
  token: string;
  publishOptions?: { [K in keyof S]?: NotionPublishOptions };
}

/**
 * Node.js 向け高レベル API。`notionSource` + `nodePreset` + `createClient` をまとめて呼ぶ。
 *
 * @deprecated v1.0.0 で削除予定 (Issue #312 / M1)。`createClient` を直接使ってください。
 * 詳細は `docs/ja/migration/createCms-to-createClient.md`。
 *
 * @example 推奨される置き換え
 * ```ts
 * import { createClient, nodePreset, notionSource } from "@notion-headless-cms/node";
 * import { schema } from "./generated/nhc";
 *
 * export const cms = createClient({
 *   sources: { notion: notionSource({ schema, token: process.env.NOTION_TOKEN! }) },
 *   ...nodePreset(),
 * });
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
    ...nodePreset(),
  });
}
