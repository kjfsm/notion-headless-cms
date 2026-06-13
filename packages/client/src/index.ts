import type {
  BaseContentItem,
  CacheAdapter,
  CMSGlobalOps,
  CollectionClient,
  FindOptions,
  SWRConfig,
} from "@notion-headless-cms/core";
import { createClient, nodePreset } from "@notion-headless-cms/core";
import {
  blocksFetcher,
  type FetchBlockTreeOgpOptions,
} from "@notion-headless-cms/fetch-blocks";
import {
  markdownFetcher,
  notionMarkdownRenderer,
} from "@notion-headless-cms/fetch-markdown";
import type {
  CMSItemFromSchema,
  CollectionSchemaEntry,
  NotionPublishOptions,
  SchemaMap,
} from "@notion-headless-cms/notion-source";
import { notionSource } from "@notion-headless-cms/notion-source";
import type { NotionBlock } from "@notion-headless-cms/react-renderer";

export type {
  BaseContentItem,
  CacheAdapter,
  CMSClient,
  CMSGlobalOps,
  CreateClientOptions,
  ItemWithContent,
  PageLinkMap,
  ResolvedPageLink,
  SWRConfig,
} from "@notion-headless-cms/core";
export {
  buildPageIndex,
  buildPageLinkMap,
  CMSError,
  createClient,
  isCMSError,
  isCMSErrorInNamespace,
  matchCMSError,
  memoryCache,
  nodePreset,
  normalizePageId,
} from "@notion-headless-cms/core";
export type { FetchBlockTreeOgpOptions } from "@notion-headless-cms/fetch-blocks";
export { blocksFetcher } from "@notion-headless-cms/fetch-blocks";
export { markdownFetcher } from "@notion-headless-cms/fetch-markdown";
export type {
  NotionPublishOptions,
  NotionSourceConfig,
  SchemaMap,
} from "@notion-headless-cms/notion-source";
export { notionSource } from "@notion-headless-cms/notion-source";

/**
 * 本文の取得・表現モード。`createCMS` の唯一の本文に関する決定。
 * - `"html"`: Markdown 取得 + Markdown→HTML renderer（Hono / Express / Astro 等）
 * - `"react"`: BlockObjectResponse ツリー取得（react-renderer の `<Renderer />` 用）
 *
 * 取得戦略（markdownFetcher / blocksFetcher）と renderer の対応は内部で結線するため、
 * 両者を別々に指定して不整合を起こすフットガンが無い。
 */
export type ContentMode = "html" | "react";

/** `"html"` モードのアイテムに生える本文アクセサ。 */
type HtmlItem<T> = T & {
  html(): Promise<string>;
  markdown(): Promise<string>;
};

/** `"react"` モードのアイテムに生える本文アクセサ。 */
type ReactItem<T> = T & {
  /**
   * Notion BlockObjectResponse ツリーを返す。`@notion-headless-cms/client/react`
   * の `<Renderer blocks={...} />` にそのまま渡せる（キャスト不要）。
   * `"react"` モードでは常に取得できる（`undefined` にならない）。
   */
  notionBlocks(): Promise<NotionBlock[]>;
};

/** content モードに応じて本文アクセサを切り替える。 */
type ModeItem<T, M extends ContentMode> = M extends "react"
  ? ReactItem<T>
  : HtmlItem<T>;

/**
 * content モードでアイテム型を狭めたコレクションクライアント。
 * `find` / `check` の戻り値だけ mode に応じて差し替え、それ以外は core と同じ。
 */
type ModeCollectionClient<
  T extends BaseContentItem,
  M extends ContentMode,
> = Omit<CollectionClient<T>, "find" | "check"> & {
  find(slug: string, opts?: FindOptions): Promise<ModeItem<T, M> | null>;
  check(
    slug: string,
    currentVersion: string,
  ): Promise<{ stale: false } | { stale: true; item: ModeItem<T, M> } | null>;
};

/** `createCMS` の戻り値。schema の各コレクションが mode で型付けされる。 */
export type CMSClientFor<S extends SchemaMap, M extends ContentMode> = {
  [K in keyof S]: ModeCollectionClient<CMSItemFromSchema<S[K]>, M>;
} & CMSGlobalOps;

/**
 * schema エントリの statusField から status の許容値（literal union）を引く。
 * status プロパティの options が schema に載っているので、published/accessible を
 * 型安全にできる（typo はコンパイルエラー）。options が無ければ string にフォールバック。
 */
type StatusValuesOf<E extends CollectionSchemaEntry> = E extends {
  statusField: infer SF extends string;
  properties: infer P;
}
  ? SF extends keyof P
    ? P[SF] extends { options: readonly (infer O extends string)[] }
      ? O
      : string
    : string
  : string;

/** コレクション単位の振る舞い（公開ポリシー）。値の住所は createCMS のみ。 */
export interface CollectionBehavior<V extends string = string> {
  /** `list()` の既定絞り込みに使う公開ステータス値。 */
  published?: readonly V[];
  /** `find()` の閲覧可否判定に使うステータス値。未指定なら published と同じ。 */
  accessible?: readonly V[];
}

/**
 * ランタイム配線。`nodePreset()` / `cloudflarePreset({ env, ctx })` /
 * `nextPreset()` の戻り値をそのまま渡せる。省略時は node 既定（memoryCache）。
 */
export interface RuntimeConfig {
  cache?: readonly CacheAdapter[];
  swr?: SWRConfig;
  waitUntil?: (p: Promise<unknown>) => void;
}

/**
 * `createCMS` のオプション。
 * - **構造**（DB 由来）は `schema`（生成物）に集約。
 * - **振る舞い**（token / content / 公開ポリシー / ランタイム）はここで定義。
 */
export interface CreateCMSOptions<
  S extends SchemaMap,
  M extends ContentMode = "html",
> {
  /** `nhc generate` が出力した schema（DB 構造の単一の真実源）。 */
  schema: S;
  /** Notion API トークン。 */
  token: string;
  /** 本文モード。省略時は `"html"`。 */
  content?: M;
  /** コレクション別の公開ポリシー。published/accessible は schema の status 値で型付けされる。 */
  collections?: { [K in keyof S]?: CollectionBehavior<StatusValuesOf<S[K]>> };
  /** ランタイム配線。省略時は `nodePreset()`。 */
  runtime?: RuntimeConfig;
  /**
   * bookmark / link_preview / embed ブロックの OGP（リンクプレビュー）取得設定。
   * `content: "react"` のときのみ効く（`"html"` では無視）。
   *
   * **既定はオン**。省略 / `true` で `{ enabled: true }` 相当となり、サーバー側で
   * OGP メタデータを取得してブロックに付与する（取得結果はドキュメントキャッシュに同梱されるため
   * 追加のキャッシュ設定は不要）。OG 画像は `imageCache` 未指定なら元 URL のまま流し、
   * ブラウザが直接読み込む（R2 等への永続キャッシュなし）。
   *
   * - `false`: OGP 取得を無効化する。
   * - `{ enabled: true, imageCache }`: OG 画像も R2 等へ永続化したい上級者向け。
   */
  ogp?: boolean | FetchBlockTreeOgpOptions;
}

/**
 * `createCMS` の `ogp` オプションを `blocksFetcher` 用の設定へ正規化する。
 * 既定（省略 / `true`）はオンにし、OG 画像はブラウザ直読み（imageCache なし）とする。
 */
function resolveOgpOption(
  ogp: boolean | FetchBlockTreeOgpOptions | undefined,
): FetchBlockTreeOgpOptions {
  if (ogp === undefined || ogp === true) return { enabled: true };
  if (ogp === false) return { enabled: false };
  return ogp;
}

/**
 * createCMS の画像プロキシのベース URL（固定）。
 * `cms.handler()` の既定ルート (`{basePath}/images` = `/api/cms/images`) と一致させ、
 * cacheImage が書き込む URL と handler の配信先が常に揃うようにする。
 * createCMS では設定不可（低レベルに調整したい場合は createClient の imageProxyBase を使う）。
 */
const CMS_IMAGE_PROXY_BASE = "/api/cms/images";

/**
 * schema（構造）と振る舞いを分離して CMS クライアントを 1 つの呼び出しで組み立てる。
 * `createClient` + `notionSource` + preset の合成を内部に隠蔽する単一エントリ。
 *
 * @example Node（既定ランタイム）
 * ```ts
 * import { createCMS } from "@notion-headless-cms/client";
 * import { schema } from "./generated/nhc";
 *
 * export const cms = createCMS({
 *   schema,
 *   token: process.env.NOTION_TOKEN!,
 *   content: "html",
 *   collections: { posts: { published: ["公開済み"] } },
 * });
 * ```
 *
 * @example Cloudflare（runtime に preset を渡す）
 * ```ts
 * import { createCMS } from "@notion-headless-cms/client";
 * import { cloudflarePreset } from "@notion-headless-cms/cache/cloudflare";
 *
 * export const makeCms = (env: Env, ctx: ExecutionContext) =>
 *   createCMS({
 *     schema,
 *     token: env.NOTION_TOKEN,
 *     content: "react",
 *     runtime: cloudflarePreset({ env, ctx }),
 *     collections: { posts: { published: ["公開済み"] } },
 *   });
 * ```
 */
export function createCMS<S extends SchemaMap, M extends ContentMode = "html">(
  opts: CreateCMSOptions<S, M>,
): CMSClientFor<S, M> {
  const content: ContentMode = opts.content ?? "html";
  // content モードが取得戦略を一意に決める（renderer も同時に内部結線）。
  // react モードは OGP（リンクプレビュー）を既定オンで取得する。
  const fetch =
    content === "react"
      ? blocksFetcher({ ogp: resolveOgpOption(opts.ogp) })
      : markdownFetcher();

  const publishOptions: { [K in keyof S]?: NotionPublishOptions } = {};
  if (opts.collections) {
    for (const key of Object.keys(opts.collections) as (keyof S)[]) {
      const behavior = opts.collections[key];
      if (!behavior) continue;
      publishOptions[key] = {
        ...(behavior.published
          ? { publishedStatuses: behavior.published }
          : {}),
        ...(behavior.accessible
          ? { accessibleStatuses: behavior.accessible }
          : {}),
      };
    }
  }

  const runtime: RuntimeConfig = opts.runtime ?? nodePreset();

  const client = createClient({
    sources: {
      notion: notionSource({
        schema: opts.schema,
        token: opts.token,
        fetch,
        publishOptions,
      }),
    },
    // html モードのみ Markdown→HTML renderer を注入する。react は notionBlocks を直接使う。
    ...(content === "html" ? { renderer: notionMarkdownRenderer } : {}),
    // 画像プロキシは handler の既定ルートに固定（createCMS では変更不可）。
    imageProxyBase: CMS_IMAGE_PROXY_BASE,
    ...(runtime.cache ? { cache: runtime.cache } : {}),
    ...(runtime.swr ? { swr: runtime.swr } : {}),
    ...(runtime.waitUntil ? { waitUntil: runtime.waitUntil } : {}),
  });

  // 実行時オブジェクトは全アクセサを持つが、型は content モードで狭める。
  return client as unknown as CMSClientFor<S, M>;
}
