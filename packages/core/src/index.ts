// ── メインAPI ──────────────────────────────────────────────────────────────

// ── キャッシュユーティリティ ───────────────────────────────────────────────
export { isStale, sha256Hex } from "./cache";
export type {
	MemoryDocumentCacheOptions,
	MemoryImageCacheOptions,
} from "./cache/memory";
export {
	memoryCache,
	memoryDocumentCache,
	memoryImageCache,
} from "./cache/memory";
export { noopDocumentCache, noopImageCache } from "./cache/noop";
export type { CacheAccessor } from "./cms";
export { CMS, createCMS } from "./cms";

// ── エラー ────────────────────────────────────────────────────────────────
export type { CMSErrorCode, CMSErrorContext } from "./errors";
export { CMSError, isCMSError, isCMSErrorInNamespace } from "./errors";

// ── フック・ロガー・プラグイン ──────────────────────────────────────────────
export { mergeHooks, mergeLoggers } from "./hooks";
export type { QueryResult } from "./query";
// ── クエリ ────────────────────────────────────────────────────────────────
export { QueryBuilder } from "./query";
export type { RetryConfig } from "./retry";
// ── リトライ ──────────────────────────────────────────────────────────────
export { DEFAULT_RETRY_CONFIG, withRetry } from "./retry";
// ── 公開型 ────────────────────────────────────────────────────────────────
export type {
	CacheConfig,
	DocumentCacheAdapter,
	ImageCacheAdapter,
} from "./types/cache";
export type {
	ContentConfig,
	CreateCMSOptions,
	RateLimiterConfig,
	RendererFn,
	RenderOptions,
	SchemaConfig,
} from "./types/config";
export type {
	BaseContentItem,
	CachedItem,
	CachedItemList,
	CMSSchemaProperties,
	StorageBinary,
} from "./types/content";
export type { CMSHooks, MaybePromise } from "./types/hooks";
export type { Logger } from "./types/logger";
export type { CMSPlugin } from "./types/plugin";
export { definePlugin } from "./types/plugin";
export type {
	DataSourceAdapter,
	SourceQueryOptions,
	SourceQueryResult,
} from "./types/source";
