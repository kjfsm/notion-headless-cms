import type { CMSAdapter } from "@notion-headless-cms/core/source-author";
import type { ContentFetcher } from "@notion-headless-cms/notion-orm";
import { createNotionCollection } from "@notion-headless-cms/notion-orm";
import type { CollectionsFromSchema, SchemaMap } from "./schema-types.js";

export type {
  CMSItemFromSchema,
  CollectionSchemaEntry,
  CollectionsFromSchema,
  DataCollectionSchemaEntry,
  PageCollectionSchemaEntry,
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
  /**
   * `list()` のデフォルト絞り込みに使う公開ステータス値。
   * 同コレクション内で `accessibleStatuses` も指定する場合は、
   * `accessibleStatuses` の部分集合になるよう指定すること (詳細: docs/ja/recipes/multi-source.md)。
   */
  publishedStatuses?: readonly string[];
  /**
   * `get()` の閲覧可否判定に使うステータス値。
   * 未指定時は `publishedStatuses` で代用される (= 同じ集合)。
   * 明示すると「下書きでも URL 直叩きでは閲覧可」のような分離が可能。
   */
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
   *
   * カスタムブロックハンドラ / OGP 取得は `blocksFetcher({ blocks, ogp })` 内で指定する。
   */
  fetch?: ContentFetcher;
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
    const isData = entry.kind === "data";
    // 要素コレクションは slug を持たないため slugField を渡さず、mapper の slug 必須チェックを回避する。
    const slugField = isData ? undefined : entry.slugField;
    const def = {
      ...(isData ? { kind: "data" as const } : {}),
      source: createNotionCollection({
        token: opts.token,
        dataSourceId: entry.dataSourceId,
        ...(entry.dbName ? { dbName: entry.dbName } : {}),
        properties: entry.properties,
        // parseWebhook が返す InvalidateScope.collection に使う論理名。
        collectionName: name,
        ...(slugField ? { slugField } : {}),
        ...(opts.fetch ? { content: opts.fetch } : {}),
      }),
      ...(slugField ? { slugField } : {}),
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
