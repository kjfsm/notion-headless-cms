import { createClient, memoryCache } from "@notion-headless-cms/core";
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
export type { NextHandlerOptions } from "./next-handler";
export { createNextHandler } from "./next-handler";
export type {
  NextRevalidateResolver,
  NextWebhookOptions,
} from "./next-webhook";
export { createNextWebhookHandler } from "./next-webhook";

/** `createCms()` に渡すオプション（Next.js 向け）。 */
export interface CreateCmsOptions<S extends SchemaMap>
  extends Pick<NotionSourceConfig<S>, "fetch"> {
  schema: S;
  token: string;
  publishOptions?: { [K in keyof S]?: NotionPublishOptions };
}

/**
 * Next.js App Router 向け高レベル API。`notionSource` + `memoryCache` + `createClient` をまとめて呼ぶ。
 * 永続キャッシュが必要な場合は `createClient` を直接使い、`cache-next` アダプタを組み込むこと。
 *
 * @example
 * import { createCms } from "@notion-headless-cms/next";
 * import { schema } from "./generated/nhc.js";
 *
 * export const cms = createCms({
 *   schema,
 *   token: process.env.NOTION_TOKEN!,
 *   publishOptions: { posts: { publishedStatuses: ["公開済み"] } },
 * });
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
    cache: [memoryCache()],
  });
}
