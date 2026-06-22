import type { CacheAdapter } from "./cache";
import type { BaseContentItem } from "./content";
import type { DataSource } from "./data-source";
import type { CMSHooks } from "./hooks";
import type { Logger } from "./logger";
import type { CMSPlugin } from "./plugin";
import type { RealtimeAdapter } from "./realtime";
import type { CMSSources } from "./sources";

/** `Logger` の出力を絞り込むログレベル。指定したレベル未満のログを抑制する。 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * renderer プラグインの不透明型。
 * core は unified / remark / rehype に依存せず、このリストをそのまま renderer に渡すだけ。
 */
export type RendererPluginList = unknown[];

/**
 * render() オプション。core は renderer の実装を知らず、この型だけを扱う。
 * @notion-headless-cms/markdown-html の renderMarkdown() はこのシグネチャと構造的に互換。
 */
export interface RenderOptions {
  imageProxyBase?: string;
  cacheImage?: (url: string) => Promise<string>;
  remarkPlugins?: RendererPluginList;
  rehypePlugins?: RendererPluginList;
}

/** カスタムレンダラー関数の型。デフォルトは @notion-headless-cms/markdown-html の renderMarkdown。 */
export type RendererFn = (
  markdown: string,
  opts?: RenderOptions,
) => Promise<string>;

/** レンダリング・コンテンツ処理設定。 */
export interface ContentConfig {
  /** 追加する remark プラグイン。 */
  remarkPlugins?: RendererPluginList;
  /** 追加する rehype プラグイン。 */
  rehypePlugins?: RendererPluginList;
}

/** SWR（Stale-While-Revalidate）設定。 */
export interface SWRConfig {
  /**
   * 再チェックの最小間隔（coalescing, ミリ秒）。最後に Notion と突合してから
   * この時間内は Notion を再照会しない（複数端末・連続アクセスの照会を集約する）。
   * 既定 30_000（30 秒）。これは webhook なしを基準にした保守的な値。
   *
   * Notion webhook を設定して更新を即時反映する構成では、push が主経路となり
   * この裏チェックはフォールバックになる。その場合は長め（例: 300_000 = 5 分）にして
   * Notion API / サブリクエスト消費を抑えてよい（フォアグラウンドは常にキャッシュ即返しのため
   * 体感速度には影響しない）。
   */
  recheckWindowMs?: number;
  /**
   * ブロック閾値（ミリ秒）。キャッシュの最終確認からこの時間を超えたアイテムを
   * 開いたときは、stale を返さずブロッキングで Notion から再取得する。
   * 未設定時の既定は「Notion webhook secret あり → 無期限（ブロックしない）/
   * なし → 7 日」。明示設定すると webhook 有無に関わらずその値を使う。
   */
  staleBlockMs?: number;
}

/**
 * `RateLimiterConfig` のデフォルト値 (Issue #313 / M2)。
 * 型からだけでは見えない既定値を表面化することで、IDE 補完と
 * preset の対称化 (`nodePreset` / `cloudflarePreset` / `nextPreset`) で
 * 同じ既定が適用されることを保証する。
 */
export const DEFAULT_RATE_LIMITER: Required<RateLimiterConfig> = {
  maxConcurrent: 3,
  retryOn: [429, 502, 503],
  maxRetries: 4,
  baseDelayMs: 1000,
};

/** レートリミット・リトライ設定。既定値は {@link DEFAULT_RATE_LIMITER}。 */
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
 * コレクション 1 件の定義。CLI が生成する `nhc.ts` から `createClient` に渡される。
 *
 * `source` は notion-orm 等の DataSource 実装。
 * `slugField` / `statusField` は TS フィールド名 (DataSource の `properties` キーと一致)。
 */
export interface CollectionDef<T extends BaseContentItem = BaseContentItem> {
  /** コレクション種別。`"data"` は要素（URL ルーティングしないデータ）。既定は `"page"`。 */
  kind?: "page" | "data";
  /** Notion etc. のデータソース実装。 */
  source: DataSource<T>;
  /**
   * slug として使う TS フィールド名。`source.properties[slugField]` で Notion プロパティ名を解決する。
   * ページコレクション（`kind: "page"`）では必須。要素コレクション（`kind: "data"`）では未指定。
   */
  slugField?: string;
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
 * 要素（データ）コレクション 1 件の定義。`kind: "data"` で slug を持たない。
 * `createClient` は判別共用体としては扱わず、`CollectionDef` の `kind`/`slugField` で分岐する。
 */
export interface DataCollectionDef<T extends BaseContentItem = BaseContentItem>
  extends Omit<CollectionDef<T>, "kind" | "slugField"> {
  kind: "data";
}

/**
 * `CollectionDef` の strict 版。`slugField` / `statusField` が `keyof T & string` で
 * 型ガードされており、誤フィールド名は型エラーになる (Issue #314 / M3)。
 * CLI 生成スキーマや `defineCollection<T>()` 経由で利用される。
 */
export interface StrictCollectionDef<T extends BaseContentItem>
  extends Omit<CollectionDef<T>, "slugField" | "statusField"> {
  /** slug として使う TS フィールド名。`keyof T` で型ガードされる。 */
  slugField: keyof T & string;
  /** ステータスとして使う TS フィールド名。`keyof T` で型ガードされる。 */
  statusField?: keyof T & string;
}

/**
 * 型推論ヘルパー: `T` を明示してコレクション定義を作る。`slugField` / `statusField` は
 * `keyof T & string` で補完・型ガードされ、誤フィールド名 (例: `"slag"`) で型エラーになる
 * (Issue #314 / M3)。CLI 生成 `nhc.schema.ts` で利用される。
 *
 * @example
 * ```ts
 * type PostItem = BaseContentItem & { authorName?: string };
 * const posts = defineCollection<PostItem>({
 *   source: notionSource(...),
 *   slugField: "slug",     // OK
 *   statusField: "status", // OK
 *   // statusField: "stat", // 型エラー
 * });
 * ```
 */
export function defineCollection<T extends BaseContentItem>(
  def: StrictCollectionDef<T>,
): CollectionDef<T> {
  // StrictCollectionDef は CollectionDef の slugField/statusField を絞ったサブ型なので
  // 構造的に CollectionDef<T> へ代入可能。型システム上は再構成のため as 経由。
  return def as unknown as CollectionDef<T>;
}

/**
 * `createClient({ collections })` の map 型。
 * キーがコレクション名、値が `CollectionDef<T>`。
 */
export type CollectionsConfig = Record<string, CollectionDef<BaseContentItem>>;

/** `CollectionsConfig` から各 T を抽出するユーティリティ型。 */
export type InferCollectionItem<C> =
  C extends CollectionDef<infer T> ? T : BaseContentItem;

/**
 * `createClient()` の入力。
 *
 * @example
 * import { createClient, nodePreset } from "@notion-headless-cms/core";
 * import { notionSource } from "@notion-headless-cms/notion-source";
 * import { schema } from "./generated/nhc.schema";
 *
 * const cms = createClient({
 *   sources: { notion: notionSource({ schema, token: process.env.NOTION_TOKEN! }) },
 *   ...nodePreset(),
 * });
 */
export interface CreateClientOptions<S extends CMSSources = CMSSources> {
  /** データソースアダプター (`@notion-headless-cms/notion-source` 等) のマップ。 */
  sources?: S;
  /**
   * キャッシュアダプタ (配列)。未指定時はキャッシュなし。
   * - `memoryCache()` のように doc + image 両方を担当するもの
   * - `r2Cache()` (image のみ)、`kvCache()` (doc のみ) のように片側のみ担当するもの
   * - 複数 adapter を配列で組み合わせると、各 adapter の `handles` で振り分けられる
   */
  cache?: readonly CacheAdapter[];
  /** SWR（Stale-While-Revalidate）設定。 */
  swr?: SWRConfig;
  /**
   * 更新通知トランスポート。設定すると、キャッシュ最新化（SWR 差分検出 / webhook 再ウォーム）
   * の直後に `publish({ collection, slug, version })` が呼ばれ、接続中クライアントへ
   * push できる。未設定なら通知しない（既存挙動と同じ）。実装は fail-soft 前提。
   */
  realtime?: RealtimeAdapter;
  /**
   * Markdown→HTML レンダラー。
   * 省略時は `@notion-headless-cms/markdown-html` の `renderMarkdown` を動的 import で使用する。
   * カスタム実装も `RendererFn` 型を満たせば使用可能。
   */
  renderer?: RendererFn;
  /** 画像プロキシのベース URL。デフォルト `/api/images`。 */
  imageProxyBase?: string;
  /** Cloudflare Workers の `waitUntil` に相当する非同期処理の登録関数。 */
  waitUntil?: (p: Promise<unknown>) => void;
  /**
   * Notion 公式 webhook（integration の Webhooks）の検証トークン（HMAC 署名キー）。
   * 設定すると `cms.handler()` の `POST {basePath}/notion-webhook` が署名検証つきで有効になり、
   * 受信イベントの対象ページを `warmByPageId` で再ウォームする。
   * `cms.handler({ notionWebhook: { secret } })` で個別上書きも可能。
   */
  notionWebhookSecret?: string;
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
