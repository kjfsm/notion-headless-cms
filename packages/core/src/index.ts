// ── メインAPI ──────────────────────────────────────────────────────────────

// ── キャッシュユーティリティ ───────────────────────────────────────────────
export { isStale, sha256Hex } from "./cache";
export {
	memoryCache,
	memoryDocumentCache,
	memoryImageCache,
} from "./cache/memory";
export { noopDocumentCache, noopImageCache } from "./cache/noop";
export { CMS, createCMS } from "./cms";

// ── エラー ────────────────────────────────────────────────────────────────
export type { CMSErrorCode, CMSErrorContext } from "./errors";
export { CMSError, isCMSError } from "./errors";

// ── フック・ロガー・プラグイン ──────────────────────────────────────────────
export { mergeHooks, mergeLoggers } from "./hooks";
// ── 低レベルAPI ───────────────────────────────────────────────────────────
export { getPlainText, mapItem } from "./mapper";
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
