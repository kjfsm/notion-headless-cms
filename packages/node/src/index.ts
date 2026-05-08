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

/** `createCms()` に渡すオプション。 */
export interface CreateCmsOptions<S extends SchemaMap>
  extends Pick<NotionSourceConfig<S>, "blocks" | "enrichers" | "ogp"> {
  schema: S;
  token: string;
  publishOptions?: { [K in keyof S]?: NotionPublishOptions };
}

/**
 * Node.js 向け高レベル API。`notionSource` + `nodePreset` + `createClient` をまとめて呼ぶ。
 *
 * @example
 * import { createCms } from "@notion-headless-cms/node";
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
        ...(opts.blocks ? { blocks: opts.blocks } : {}),
        ...(opts.enrichers ? { enrichers: opts.enrichers } : {}),
        ...(opts.ogp ? { ogp: opts.ogp } : {}),
        publishOptions: opts.publishOptions,
      }),
    },
    ...nodePreset(),
  });
}
