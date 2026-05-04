// このファイルは nhc generate により自動生成されました。手動編集は nhc generate で上書きされます。
// Generated: 2026-05-04T07:19:07.719Z

import {
  createCMS as _createCMS,
  type CacheAdapter,
  type CMSGlobalOps,
  type CMSHooks,
  type CollectionClient,
  type Logger,
  type PropertyMap,
  type RendererFn,
  type SWRConfig,
} from "@notion-headless-cms/core";
import { createNotionCollection } from "@notion-headless-cms/notion-orm";
import type { BlockHandler } from "@notion-headless-cms/renderer";

// ===========================================================
// posts  (ブログ記事DB)
// Notion DB ID: 34a21462-5ae9-80a7-a17b-000b93010c9f
// ===========================================================

export const postsDataSourceId = "34a21462-5ae9-80a7-a17b-000b93010c9f";

/** Notion DB "ブログ記事DB" のプロパティマップ。 */
export const postsProperties = {
  status: { type: "status" as const, notion: "ステータス" },
  publishedAt: { type: "date" as const, notion: "公開日" },
  slug: { type: "richText" as const, notion: "URL" },
  author: { type: "select" as const, notion: "著者" },
  name: { type: "title" as const, notion: "名前" },
} as const satisfies PropertyMap;

/** posts コレクションの 1 アイテム型。 */
export interface Post {
  /** Notion ページ ID。 */
  id: string;
  /** Notion ページの最終編集時刻 (ISO8601)。 */
  lastEditedTime: string;
  /** ページ作成日時 (ISO8601)。 */
  createdAt?: string;
  /** アーカイブ済み / ゴミ箱に入っている場合 true。core の list() から自動除外される。 */
  isArchived?: boolean;
  /** カバー画像 URL。未設定の場合は null。 */
  coverImageUrl?: string | null;
  /** 絵文字アイコン。絵文字以外 / 未設定の場合は null。 */
  iconEmoji?: string | null;
  /** Notion property: "ステータス" */
  status: "下書き" | "編集中" | "公開済み" | null;
  /** Notion property: "公開日" */
  publishedAt: string | null;
  /** Notion property: "URL" */
  slug: string;
  /** Notion property: "著者" */
  author: string | null;
  /** Notion property: "名前" */
  name: string | null;
  /** Notion ページタイトル。 */
  title?: string | null;
}

// =============================================================
// CMS factory
// =============================================================

/** `createCMS()` に渡すランタイム設定。Notion トークンとキャッシュ等を指定する。 */
export interface NhcConfig {
  /** Notion API トークン。 */
  notionToken: string;
  /** キャッシュアダプタ (配列)。 */
  cache?: readonly CacheAdapter[];
  /** SWR（Stale-While-Revalidate）設定。 */
  swr?: SWRConfig;
  /** カスタムレンダラー。省略時は `@notion-headless-cms/renderer` を自動使用。 */
  renderer?: RendererFn;
  /** 画像プロキシのベース URL。デフォルト `/api/images`。 */
  imageProxyBase?: string;
  /** Cloudflare Workers の `waitUntil` 相当。 */
  waitUntil?: (p: Promise<unknown>) => void;
  /** embed / video 等の Notion ブロックをカスタム処理するハンドラマップ。 */
  blocks?: Record<string, BlockHandler>;
  /** ロガー。キャッシュイベントや内部処理のログを受け取る。 */
  logger?: Logger;
  /** ライフサイクルフック (onCacheHit / onCacheMiss 等)。 */
  hooks?: CMSHooks;
}

/** 生成された CMS クライアントの型。 */
export interface Nhc extends CMSGlobalOps {
  posts: CollectionClient<Post>;
}

/**
 * Nhc クライアントを構築する。コレクションごとの DB ID とプロパティマップは生成時に固定済み。
 *
 * @example
 * import { createCMS } from "./generated/nhc";
 * import { memoryCache } from "@notion-headless-cms/cache";
 * import { notionEmbed, youtubeProvider } from "@notion-headless-cms/notion-embed";
 *
 * const embed = notionEmbed({ providers: [youtubeProvider({ display: "card" })] });
 *
 * export const cms = createCMS({
 *   notionToken: process.env.NOTION_TOKEN!,
 *   renderer: embed.renderer,
 *   blocks: embed.blocks,
 *   cache: [memoryCache()],
 *   swr: { ttlMs: 5 * 60_000 },
 * });
 *
 * await cms.posts.list();
 * const item = await cms.posts.find("hello");
 * const html = await item?.html();
 */
export function createCMS(config: NhcConfig): Nhc {
  return _createCMS({
    cache: config.cache,
    swr: config.swr,
    renderer: config.renderer,
    imageProxyBase: config.imageProxyBase,
    waitUntil: config.waitUntil,
    logger: config.logger,
    hooks: config.hooks,
    collections: {
      posts: {
        source: createNotionCollection({
          token: config.notionToken,
          dataSourceId: postsDataSourceId,
          properties: postsProperties,
          ...(config.blocks ? { blocks: config.blocks } : {}),
        }),
        slugField: "slug",
        statusField: "status",
        publishedStatuses: ["公開済み"] as const,
        accessibleStatuses: ["下書き", "編集中", "公開済み"] as const,
      },
    },
  }) as unknown as Nhc;
}
