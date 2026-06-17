import type {
  BaseContentItem,
  CacheAdapter,
  CMSGlobalOps,
  CollectionClient,
  DataCollectionClient,
  FindOptions,
  Logger,
  LogLevel,
  RealtimeAdapter,
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
  DataCollectionClient,
  ItemWithContent,
  LogContext,
  Logger,
  LogLevel,
  MemoryCacheOptions,
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

/**
 * `createCMS` の戻り値。schema の各コレクションが mode で型付けされる。
 * 要素コレクション（`kind: "data"`）は本文を持たない `DataCollectionClient`、
 * ページコレクションは mode で本文アクセサを差し替えた `ModeCollectionClient`。
 */
export type CMSClientFor<S extends SchemaMap, M extends ContentMode> = {
  [K in keyof S]: S[K] extends { kind: "data" }
    ? DataCollectionClient<CMSItemFromSchema<S[K]>>
    : ModeCollectionClient<CMSItemFromSchema<S[K]>, M>;
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
 * notion（取得元）設定。Notion からの取得に必要なものを集約する。
 * - `schema`: `nhc generate` が出力した DB 構造の単一の真実源
 * - `token`: Notion API トークン（Notion 認証）
 * - `collections`: コレクション別の公開ポリシー（Notion status 値で型付け）
 */
export interface CmsNotionConfig<S extends SchemaMap> {
  /** `nhc generate` が出力した schema（DB 構造の単一の真実源）。 */
  schema: S;
  /** Notion API トークン。 */
  token: string;
  /**
   * コレクション別の公開ポリシー。published/accessible は schema の status 値で型付けされる。
   * 要素コレクション（`kind: "data"`）は公開フィルタを持たないため、値の型は `never`
   * になり published/accessible を設定するとコンパイルエラーになる。
   */
  collections?: {
    [K in keyof S]?: S[K] extends { kind: "data" }
      ? never
      : CollectionBehavior<StatusValuesOf<S[K]>>;
  };
  /**
   * Notion 公式 webhook（integration の Webhooks）の検証トークン。設定すると
   * `cms.handler()` の `POST {basePath}/notion-webhook` が署名検証つきで有効になり、
   * 更新されたページを自動でミラー再生成する。`wrangler secret put` 等で渡し、ハードコードしない。
   */
  webhookSecret?: string;
  /**
   * webhook サブスク登録時に Notion が送る `verification_token` を受け取るコールバック。
   * トークンを取得して `webhookSecret` に設定する用途。
   *
   * @example
   * ```ts
   * createCMS({
   *   notion: {
   *     onVerificationToken: (token) => console.log("verification_token:", token),
   *   },
   * });
   * ```
   */
  onVerificationToken?: (token: string) => void;
}

/**
 * render（出力先）設定。本文の取得戦略・表現に関わるものを集約する。
 * 画像プロキシのベース URL は `cms.handler()` の既定ルートに固定のため createCMS では設定しない
 * （低レベルに調整したい場合は createClient の imageProxyBase を使う）。
 */
export interface CmsRenderConfig<M extends ContentMode = "html"> {
  /** 本文モード。省略時は `"html"`。 */
  content?: M;
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
 * cache（キャッシュ戦略）設定。どこに永続化し、いつ再検証するかを役割別に明示する。
 *
 * document / image にそれぞれ `CacheAdapter` を渡す（`kvCache` / `r2Cache` / `memoryCache`
 * など）。`env` を丸ごと渡す旧 preset と違い、どの binding がどのキャッシュかが呼び出し側で
 * 一目で分かる。`cache` 自体を省略すると node 既定（memoryCache が document/image 兼用）になる。
 */
export interface CmsCacheConfig {
  /** 文書（list/meta/content）キャッシュのアダプタ。 */
  document?: CacheAdapter;
  /** 画像キャッシュのアダプタ。 */
  image?: CacheAdapter;
  /** SWR（Stale-While-Revalidate）戦略。省略時は ttlMs 5 分。 */
  swr?: SWRConfig;
  /**
   * SWR バックグラウンド更新を応答送信後も完走させる実行フック。
   * Cloudflare Workers では `(p) => ctx.waitUntil(p)` を渡す。Node では不要。
   */
  waitUntil?: (p: Promise<unknown>) => void;
}

/**
 * `createCMS` のオプション。データの流れ「取得 → 表現 → 永続化」で 3 グループに分ける。
 * - `notion`: 取得元（schema / token / 公開ポリシー）
 * - `render`: 出力先（本文モード / OGP）
 * - `cache`: キャッシュ戦略（document / image アダプタ / swr / waitUntil）
 */
export interface CreateCMSOptions<
  S extends SchemaMap,
  M extends ContentMode = "html",
> {
  /** 取得元（Notion 接続）設定。 */
  notion: CmsNotionConfig<S>;
  /** 出力先（表現）設定。省略可。 */
  render?: CmsRenderConfig<M>;
  /** キャッシュ戦略設定。省略時は node 既定（memoryCache + swr 5 分）。 */
  cache?: CmsCacheConfig;
  /**
   * 更新通知トランスポート（push）。設定すると、SWR 差分検出 / webhook 再ウォームで
   * キャッシュ最新化した直後に接続中クライアントへ push できる。
   * Cloudflare では `durableObjectRealtime`（`@notion-headless-cms/client/cloudflare`）を渡す。
   */
  realtime?: RealtimeAdapter;
  /**
   * ログ出力先。未指定ならログを出力しない。
   *
   * @example
   * ```ts
   * createCMS({
   *   logger: { info: console.log, warn: console.warn, error: console.error },
   * });
   * ```
   */
  logger?: Logger;
  /** logger の出力レベル下限。指定レベル未満のログを抑制する。デフォルトは全レベル出力。 */
  logLevel?: LogLevel;
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
 * @example Node（cache 省略で memory 既定）
 * ```ts
 * import { createCMS } from "@notion-headless-cms/client";
 * import { schema } from "./generated/nhc";
 *
 * export const cms = createCMS({
 *   notion: {
 *     schema,
 *     token: process.env.NOTION_TOKEN!,
 *     collections: { posts: { published: ["公開済み"] } },
 *   },
 *   render: { content: "html" },
 * });
 * ```
 *
 * @example Cloudflare（cache を役割別に明示）
 * ```ts
 * import { createCMS } from "@notion-headless-cms/client";
 * import { kvCache, r2Cache } from "@notion-headless-cms/client/cloudflare";
 *
 * export const makeCms = (env: Env, ctx: ExecutionContext) =>
 *   createCMS({
 *     notion: {
 *       schema,
 *       token: env.NOTION_TOKEN,
 *       collections: { posts: { published: ["公開済み"] } },
 *     },
 *     render: { content: "react" },
 *     cache: {
 *       document: kvCache({ namespace: env.DOC_CACHE }),
 *       image: r2Cache({ bucket: env.IMG_BUCKET }),
 *       waitUntil: (p) => ctx.waitUntil(p),
 *     },
 *   });
 * ```
 */
export function createCMS<S extends SchemaMap, M extends ContentMode = "html">(
  opts: CreateCMSOptions<S, M>,
): CMSClientFor<S, M> {
  const content: ContentMode = opts.render?.content ?? "html";
  // content モードが取得戦略を一意に決める（renderer も同時に内部結線）。
  // react モードは OGP（リンクプレビュー）を既定オンで取得する。
  const fetch =
    content === "react"
      ? blocksFetcher({ ogp: resolveOgpOption(opts.render?.ogp) })
      : markdownFetcher();

  const publishOptions: { [K in keyof S]?: NotionPublishOptions } = {};
  if (opts.notion.collections) {
    for (const key of Object.keys(opts.notion.collections) as (keyof S)[]) {
      const behavior = opts.notion.collections[key];
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

  // cache 全体を省略したら node 既定（memoryCache + swr 5 分）。指定があれば
  // document / image アダプタを配列へ畳む（core の resolveCache が handles で先勝ち割り当て）。
  const cacheConfig = resolveCacheConfig(opts.cache);

  const client = createClient({
    sources: {
      notion: notionSource({
        schema: opts.notion.schema,
        token: opts.notion.token,
        fetch,
        publishOptions,
      }),
    },
    // html モードのみ Markdown→HTML renderer を注入する。react は notionBlocks を直接使う。
    ...(content === "html" ? { renderer: notionMarkdownRenderer } : {}),
    // 画像プロキシは handler の既定ルートに固定（createCMS では変更不可）。
    imageProxyBase: CMS_IMAGE_PROXY_BASE,
    ...(cacheConfig.cache ? { cache: cacheConfig.cache } : {}),
    ...(cacheConfig.swr ? { swr: cacheConfig.swr } : {}),
    ...(cacheConfig.waitUntil ? { waitUntil: cacheConfig.waitUntil } : {}),
    ...(opts.realtime ? { realtime: opts.realtime } : {}),
    ...(opts.notion.webhookSecret
      ? { notionWebhookSecret: opts.notion.webhookSecret }
      : {}),
    ...(opts.logger ? { logger: opts.logger } : {}),
    ...(opts.logLevel ? { logLevel: opts.logLevel } : {}),
  });

  // onVerificationToken が指定されていれば handler() に自動注入する。
  if (opts.notion.onVerificationToken) {
    const cb = opts.notion.onVerificationToken;
    const orig = client.handler.bind(client);
    client.handler = (handlerOpts?: Parameters<typeof client.handler>[0]) =>
      orig({
        ...handlerOpts,
        notionWebhook: {
          ...handlerOpts?.notionWebhook,
          onVerificationToken:
            handlerOpts?.notionWebhook?.onVerificationToken ?? cb,
        },
      });
  }

  // 実行時オブジェクトは全アクセサを持つが、型は content モードで狭める。
  return client as unknown as CMSClientFor<S, M>;
}

/**
 * `cache` 設定を `createClient` が受け取るフラットな `{ cache, swr, waitUntil }` へ変換する。
 * - 未指定: `nodePreset()`（memoryCache が document/image 兼用 + swr 5 分）にフォールバック。
 * - 指定あり: `document` → `image` の順に並べた配列を返す。省略された役割はそのまま無し
 *   （memory への暗黙フォールバックは「cache 全体省略時」のみ。明示主義）。
 */
function resolveCacheConfig(cache: CmsCacheConfig | undefined): {
  cache?: readonly CacheAdapter[];
  swr?: SWRConfig;
  waitUntil?: (p: Promise<unknown>) => void;
} {
  if (!cache) return nodePreset();
  const adapters: CacheAdapter[] = [];
  // document を先頭に並べ、resolveCache の先勝ち割り当てで役割が混ざらないようにする。
  if (cache.document) adapters.push(cache.document);
  if (cache.image) adapters.push(cache.image);
  return {
    cache: adapters,
    swr: cache.swr ?? { ttlMs: 5 * 60_000 },
    waitUntil: cache.waitUntil,
  };
}
