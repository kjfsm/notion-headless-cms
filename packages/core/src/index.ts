// ── メイン API ──────────────────────────────────────────────────────────

// ── キャッシュユーティリティ ───────────────────────────────────────────
export { isStale, sha256Hex } from "./cache";
export type {
	MemoryDocumentCacheOptions,
	MemoryImageCacheOptions,
} from "./cache/memory";
export { memoryDocumentCache, memoryImageCache } from "./cache/memory";
export { noopDocumentCache, noopImageCache } from "./cache/noop";
export type { CMSClient, CMSGlobalOps } from "./cms";
export { createCMS } from "./cms";
export type { CollectionContext } from "./collection";
// ── コレクション ─────────────────────────────────────────────────────────
export { CollectionClientImpl, collectionKey } from "./collection";
// ── コンテンツ AST ──────────────────────────────────────────────────────
export type {
	ContentBlock,
	ContentResult,
	ImageRef,
	InlineNode,
} from "./content/blocks";
// ── エラー ──────────────────────────────────────────────────────────────
export type { CMSErrorCode, CMSErrorContext } from "./errors";
export { CMSError, isCMSError, isCMSErrorInNamespace } from "./errors";
export type { HandlerAdapter, HandlerOptions } from "./handler";
// ── $handler ───────────────────────────────────────────────────────────
export { createHandler } from "./handler";
// ── フック・ロガー・プラグイン ────────────────────────────────────────
export { mergeHooks, mergeLoggers } from "./hooks";
export type { NodePresetOptions } from "./preset-node";
export { nodePreset } from "./preset-node";

// ── リトライ ───────────────────────────────────────────────────────────
export type { RetryConfig } from "./retry";
export { DEFAULT_RETRY_CONFIG, withRetry } from "./retry";

// ── 公開型 ──────────────────────────────────────────────────────────────
export type {
	AdjacencyOptions,
	BaseContentItem,
	CacheConfig,
	CachedItem,
	CachedItemList,
	CMSHooks,
	CMSPlugin,
	CMSSchema,
	CMSSchemaProperties,
	CollectionClient,
	CollectionConfig,
	CollectionSemantics,
	ContentConfig,
	CreateCMSOptions,
	DataSource,
	DataSourceFactory,
	DataSourceMap,
	DocumentCacheAdapter,
	GetListOptions,
	ImageCacheAdapter,
	InferCollectionItem,
	InferDataSourceItem,
	InvalidateScope,
	ItemWithContent,
	Logger,
	MaybePromise,
	PropertyDef,
	PropertyMap,
	RateLimiterConfig,
	RendererFn,
	RendererPluginList,
	RenderOptions,
	SortOption,
	StorageBinary,
	WebhookConfig,
} from "./types/index";
export { definePlugin } from "./types/plugin";
