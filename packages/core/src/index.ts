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

// ── 低レベルAPI ───────────────────────────────────────────────────────────
export { getPlainText, mapItem } from "./mapper";

// ── 公開型 ────────────────────────────────────────────────────────────────
export type {
	CacheConfig,
	DocumentCacheAdapter,
	ImageCacheAdapter,
} from "./types/cache";
export type {
	ContentConfig,
	CreateCMSOptions,
	SchemaConfig,
} from "./types/config";
export type {
	BaseContentItem,
	CachedItem,
	CachedItemList,
	CMSSchemaProperties,
	StorageBinary,
} from "./types/content";
export type { DataSourceAdapter } from "./types/source";
