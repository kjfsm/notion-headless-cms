import type { CacheConfig } from "./cache";
import type { BaseContentItem } from "./content";
import type { DataSource } from "./data-source";
import type { CMSHooks } from "./hooks";
import type { Logger } from "./logger";
import type { CMSPlugin } from "./plugin";

/**
 * renderer プラグインの不透明型。
 * core は unified / remark / rehype に依存せず、このリストをそのまま renderer に渡すだけ。
 */
// biome-ignore lint/suspicious/noExplicitAny: core はプラグイン詳細を知らない
export type RendererPluginList = any[];

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

/** `createCMS({ dataSources })` の map 型。 */
// biome-ignore lint/suspicious/noExplicitAny: 各コレクションの T が異なる
export type DataSourceMap = Record<string, DataSource<any>>;

/** `DataSourceMap` から各 T を抽出するユーティリティ型。 */
export type InferDataSourceItem<D> =
	D extends DataSource<infer T> ? T : BaseContentItem;

/**
 * `createCMS()` に渡すオプション。v1 の正式な入力シグネチャ。
 * ユーザーは `nhc generate` が生成した `cmsDataSources` を渡すだけ。
 */
export interface CreateCMSOptions<D extends DataSourceMap = DataSourceMap> {
	/** コレクション名 → DataSource のマップ (CLI 生成の `cmsDataSources`)。 */
	dataSources: D;
	/**
	 * ランタイムプリセット。`cache` / `renderer` のデフォルトを自動設定する。
	 *
	 * - `"node"`: Node.js 向け。`memoryDocumentCache` + `memoryImageCache` を有効化。
	 *   `ttlMs` と組み合わせて SWR の TTL を設定できる。
	 * - `"disabled"`: キャッシュを完全無効化する。
	 * - 省略: 従来の動作（`cache` / `renderer` をそのまま使用）。
	 *   `...nodePreset({ ttlMs })` のスプレッドパターンも引き続き動作する。
	 *
	 * `cache` を明示的に指定した場合は `preset` より `cache` が優先される。
	 *
	 * @example
	 * // Before（スプレッドが必要だった）
	 * const cms = createCMS({ ...nodePreset({ ttlMs: 5 * 60_000 }), dataSources });
	 *
	 * // After
	 * const cms = createCMS({ dataSources, preset: "node", ttlMs: 5 * 60_000 });
	 */
	preset?: "node" | "disabled";
	/**
	 * SWR キャッシュの有効期間（ミリ秒）。`preset` と組み合わせて使用する。
	 * `cache` オブジェクトを直接渡す場合は `cache.ttlMs` を使用すること。
	 *
	 * @example
	 * const cms = createCMS({ dataSources, preset: "node", ttlMs: 5 * 60_000 });
	 */
	ttlMs?: number;
	/** レンダラー関数。未指定時は @notion-headless-cms/renderer の renderMarkdown を使用。 */
	renderer?: RendererFn;
	/** キャッシュ設定。未設定時はキャッシュなし。 */
	cache?: CacheConfig;
	/** レンダリング・コンテンツ処理設定。 */
	content?: ContentConfig;
	/** Cloudflare Workers の waitUntil に相当する非同期処理の登録関数。 */
	waitUntil?: (p: Promise<unknown>) => void;
	/** ライフサイクルフック (全コレクション共通)。 */
	// biome-ignore lint/suspicious/noExplicitAny: 全コレクション共通
	hooks?: CMSHooks<any>;
	/** プラグイン配列。 */
	// biome-ignore lint/suspicious/noExplicitAny: 全コレクション共通
	plugins?: CMSPlugin<any>[];
	/** ロガー。 */
	logger?: Logger;
	/** レートリミット・リトライ設定。 */
	rateLimiter?: RateLimiterConfig;
}
