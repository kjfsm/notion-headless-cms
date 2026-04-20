import type { RendererFn } from "@notion-headless-cms/renderer";
import type { BlockHandler } from "@notion-headless-cms/transformer";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { PluggableList } from "unified";
import type { CacheConfig } from "./cache";
import type { BaseContentItem, CMSSchemaProperties } from "./content";
import type { CMSHooks } from "./hooks";
import type { Logger } from "./logger";
import type { CMSPlugin } from "./plugin";
import type { DataSourceAdapter } from "./source";

/** スキーマ設定。公開ステータスのフィルタやプロパティ名マッピングを制御する。 */
export interface SchemaConfig<T extends BaseContentItem = BaseContentItem> {
	/**
	 * Notionページをコンテンツ型 T にマッピングするカスタム関数。
	 * 指定した場合 properties の設定は無視される（slug プロパティ名のみ例外）。
	 */
	mapItem?: (page: PageObjectResponse) => T;
	/** mapItem 未使用時のプロパティ名マッピング。 */
	properties?: CMSSchemaProperties;
	/** list() で返す「公開済み」ステータス値の配列。デフォルト: [] （全件返す） */
	publishedStatuses?: string[];
	/** findBySlug() でアクセス可能なステータス値の配列。デフォルト: [] （全件許可） */
	accessibleStatuses?: string[];
}

/** レンダリング・コンテンツ処理設定。 */
export interface ContentConfig {
	/** 画像プロキシのベースURL。デフォルト: '/api/images' */
	imageProxyBase?: string;
	/** 追加する remark プラグイン。 */
	remarkPlugins?: PluggableList;
	/** 追加する rehype プラグイン。 */
	rehypePlugins?: PluggableList;
	/** デフォルトのパイプラインを置き換えるカスタムレンダラー。 */
	render?: RendererFn;
	/** カスタムブロックハンドラーのマップ。Notionブロックタイプをキーとする。 */
	blocks?: Record<string, BlockHandler>;
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
 * createCMS() に渡すオプション。
 * ジェネリクス型 T にカスタムコンテンツ型を指定できる（デフォルト: BaseContentItem）。
 */
export interface CreateCMSOptions<T extends BaseContentItem = BaseContentItem> {
	/** データソースアダプタ（Notion など）。 */
	source: DataSourceAdapter<T>;
	/** キャッシュ設定。未設定時はキャッシュなし。 */
	cache?: CacheConfig<T>;
	/** スキーマ・ステータス設定。 */
	schema?: SchemaConfig<T>;
	/** レンダリング・コンテンツ処理設定。 */
	content?: ContentConfig;
	/** Cloudflare Workers の waitUntil に相当する非同期処理の登録関数。 */
	waitUntil?: (p: Promise<unknown>) => void;
	/** ライフサイクルフック。 */
	hooks?: CMSHooks<T>;
	/** プラグイン配列。フックとロガーを組み合わせて提供できる。 */
	plugins?: CMSPlugin<T>[];
	/** ロガー。 */
	logger?: Logger;
	/** レートリミット・リトライ設定。 */
	rateLimiter?: RateLimiterConfig;
}
