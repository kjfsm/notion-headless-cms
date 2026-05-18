import type { CMSAdapter } from "@notion-headless-cms/core/source-author";
import type { BlockHandler } from "@notion-headless-cms/markdown-html";
import type {
  ContentFetcher,
  FetchBlockTreeOgpOptions,
} from "@notion-headless-cms/notion-orm";
import { createNotionCollection } from "@notion-headless-cms/notion-orm";
import type { CollectionsFromSchema, SchemaMap } from "./schema-types.js";

export type {
  CMSItemFromSchema,
  CollectionSchemaEntry,
  CollectionsFromSchema,
  SchemaMap,
} from "./schema-types.js";

// 宣言マージ — `import "@notion-headless-cms/notion-source"` で sources.notion キーが解禁される
declare module "@notion-headless-cms/core" {
  interface CMSSources {
    notion?: CMSAdapter;
  }
}

/** `notionSource()` のコレクション別パブリッシュオプション。 */
export interface NotionPublishOptions {
  /** `list()` のデフォルト絞り込みに使う公開ステータス値。 */
  publishedStatuses?: readonly string[];
  /** `get()` の閲覧可否判定に使うステータス値。 */
  accessibleStatuses?: readonly string[];
}

export interface NotionSourceConfig<S extends SchemaMap> {
  /** CLI 生成の `nhc.schema.ts` から import するスキーマ定義。 */
  schema: S;
  /** Notion API トークン。 */
  token: string;
  /**
   * Notion 本文の取得戦略。`@notion-headless-cms/fetch-blocks` の `blocksFetcher()` か
   * `@notion-headless-cms/fetch-markdown` の `markdownFetcher()` を渡す。
   * 未指定の場合は `fetch-blocks` を動的 import でフォールバック (現行互換)。
   *
   * Cloudflare Workers Free プラン (50 subrequest 上限) で巨大ページを扱うなら
   * `markdownFetcher()` を推奨。
   */
  fetch?: ContentFetcher;
  /**
   * カスタムブロックハンドラーのマップ。
   * @deprecated `fetch: blocksFetcher({ blocks })` に移動してください。次のメジャーで削除予定。
   */
  blocks?: Record<string, BlockHandler>;
  /**
   * embed / bookmark / link_preview ブロックの OGP 取得設定。
   * @deprecated `fetch: blocksFetcher({ ogp })` に移動してください。次のメジャーで削除予定。
   */
  ogp?: FetchBlockTreeOgpOptions;
  /** コレクションごとの公開ステータス設定。 */
  publishOptions?: { [K in keyof S]?: NotionPublishOptions };
}

/**
 * Notion DB を CMS データソースとして構築する。
 * `createClient({ sources: { notion: notionSource(...) } })` に渡す。
 */
export function notionSource<S extends SchemaMap>(
  opts: NotionSourceConfig<S>,
): CMSAdapter<CollectionsFromSchema<S>> {
  const entries = Object.entries(opts.schema).map(([name, entry]) => {
    const pubOpts = opts.publishOptions?.[name];
    const def = {
      source: createNotionCollection({
        token: opts.token,
        dataSourceId: entry.dataSourceId,
        properties: entry.properties,
        ...(opts.fetch ? { content: opts.fetch } : {}),
        ...(opts.blocks ? { blocks: opts.blocks } : {}),
        ...(opts.ogp ? { ogp: opts.ogp } : {}),
      }),
      slugField: entry.slugField,
      ...(entry.statusField ? { statusField: entry.statusField } : {}),
      publishedStatuses: pubOpts?.publishedStatuses ?? [],
      ...(pubOpts?.accessibleStatuses
        ? { accessibleStatuses: pubOpts.accessibleStatuses }
        : {}),
    };
    return [name, def] as const;
  });
  const collections = Object.fromEntries(entries) as CollectionsFromSchema<S>;
  return { collections };
}
