import type { CacheAdapter } from "./cache";
import type { BaseContentItem } from "./content";
import type { DataSource } from "./data-source";
import type { CMSHooks } from "./hooks";
import type { Logger } from "./logger";
import type { CMSPlugin } from "./plugin";

/** `Logger` の出力を絞り込むログレベル。指定したレベル未満のログを抑制する。 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * renderer プラグインの不透明型。
 * core は unified / remark / rehype に依存せず、このリストをそのまま renderer に渡すだけ。
 */
export type RendererPluginList = unknown[];

/**
 * render() オプション。core は renderer の実装を知らず、この型だけを扱う。
 * @notion-headless-cms/renderer の renderMarkdown() はこのシグネチャと構造的に互換。
 */
export interface RenderOptions {
  imageProxyBase?: string;
  cacheImage?: (url: string) => Promise<string>;
  remarkPlugins?: RendererPluginList;
  rehypePlugins?: RendererPluginList;
}

/** カスタムレンダラー関数の型。デフォルトは @notion-headless-cms/renderer の renderMarkdown。 */
export type RendererFn = (
  markdown: string,
  opts?: RenderOptions,
) => Promise<string>;

/** レンダリング・コンテンツ処理設定。 */
export interface ContentConfig {
  /** 画像プロキシのベースURL。デフォルト: '/api/images' */
  imageProxyBase?: string;
  /** 追加する remark プラグイン。 */
  remarkPlugins?: RendererPluginList;
  /** 追加する rehype プラグイン。 */
  rehypePlugins?: RendererPluginList;
}

/** レートリミット・リトライ設定。 */
export interface RateLimiterConfig {
  /** 同時実行数の上限。デフォルト: 3 */
  maxConcurrent?: number;
  /** リトライ対象の HTTP ステータスコード。デフォルト: [429, 502, 503] */
  retryOn?: number[];
  /** 最大リトライ回数。デフォルト: 4 */
  maxRetries?: number;
  /** リトライ時の基準待機時間（ミリ秒）。デフォルト: 1000 */
  baseDelayMs?: number;
}

/**
 * コレクション 1 件の定義。CLI が生成する `nhc.ts` から `createCMS` に渡される。
 *
 * `source` は notion-orm 等の DataSource 実装。
 * `slugField` / `statusField` は TS フィールド名 (DataSource の `properties` キーと一致)。
 */
export interface CollectionDef<T extends BaseContentItem = BaseContentItem> {
  /** Notion etc. のデータソース実装。 */
  source: DataSource<T>;
  /** slug として使う TS フィールド名 (必須)。`source.properties[slugField]` で Notion プロパティ名を解決する。 */
  slugField: string;
  /** ステータスとして使う TS フィールド名。 */
  statusField?: string;
  /** 公開扱いするステータス値。`list()` のデフォルト絞り込みに使う。 */
  publishedStatuses?: readonly string[];
  /** アクセス許可するステータス値。`get()` の閲覧可否判定に使う。 */
  accessibleStatuses?: readonly string[];
  /** コレクション固有のライフサイクルフック。グローバル hooks の後に実行される。 */
  hooks?: CMSHooks<T>;
}

/**
 * `createCMS({ collections })` の map 型。
 * キーがコレクション名、値が `CollectionDef<T>`。
 */
export type CollectionsConfig = Record<string, CollectionDef<BaseContentItem>>;

/** `CollectionsConfig` から各 T を抽出するユーティリティ型。 */
export type InferCollectionItem<C> =
  C extends CollectionDef<infer T> ? T : BaseContentItem;

/**
 * `createCMS()` の入力。
 * 通常は CLI が生成した `nhc.ts` の `createCMS` がこの型をラップする。
 *
 * @example
 * createCMS({
 *   collections: {
 *     posts: {
 *       source: createNotionCollection({ token, dataSourceId, properties }),
 *       slugField: "slug",
 *       statusField: "status",
 *       publishedStatuses: ["公開済み"],
 *     }
 *   },
 *   cache: memoryCache({ ttlMs: 5 * 60_000 }),
 * });
 */
export interface CreateCMSOptions<
  C extends CollectionsConfig = CollectionsConfig,
> {
  /** コレクション定義のマップ。 */
  collections: C;
  /**
   * キャッシュアダプタ (単体または配列)。未指定時はキャッシュなし。
   * - `memoryCache()` のように doc + image 両方を担当するもの
   * - `r2Cache()` (image のみ)、`kvCache()` (doc のみ) のように片側のみ担当するもの
   * - 配列で組み合わせると、各 adapter の `handles` で振り分けられる
   */
  cache?: CacheAdapter | readonly CacheAdapter[];
  /** SWR の有効期間 (ミリ秒)。未設定時は TTL なし (失効まで stale を返す)。 */
  ttlMs?: number;
  /**
   * Markdown→HTML レンダラー。
   * 省略時は `@notion-headless-cms/renderer` の `renderMarkdown` を動的 import で使用する。
   * カスタム実装も `RendererFn` 型を満たせば使用可能。
   */
  renderer?: RendererFn;
  /** 画像プロキシのベース URL。デフォルト `/api/images`。 */
  imageProxyBase?: string;
  /** Cloudflare Workers の `waitUntil` に相当する非同期処理の登録関数。 */
  waitUntil?: (p: Promise<unknown>) => void;
  /** ライフサイクルフック (全コレクション共通)。 */
  hooks?: CMSHooks<BaseContentItem>;
  /** プラグイン配列。 */
  plugins?: CMSPlugin<BaseContentItem>[];
  /** ロガー。 */
  logger?: Logger;
  /** ログレベルの下限。指定したレベル未満のログを内部で抑制する。 */
  logLevel?: LogLevel;
  /** レートリミット・リトライ設定。 */
  rateLimiter?: RateLimiterConfig;
  /** レンダリング・コンテンツ処理設定。 */
  content?: ContentConfig;
}
