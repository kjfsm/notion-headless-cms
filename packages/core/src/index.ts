// ── メインAPI ──────────────────────────────────────────────────────────────

// ── ユーティリティ ────────────────────────────────────────────────────────
export { CacheStore, isStale, sha256Hex } from "./cache";
export { CMS, createCMS } from "./cms";
export type { CMSErrorCode, CMSErrorContext } from "./errors";
// ── エラー ────────────────────────────────────────────────────────────────
export { CMSError, isCMSError } from "./errors";

// ── 低レベルAPI ───────────────────────────────────────────────────────────
export { getPlainText, mapItem } from "./mapper";

// ── 公開型 ────────────────────────────────────────────────────────────────
export type {
	BaseContentItem,
	CachedItem,
	CachedItemList,
	CMSConfig,
	CMSEnv,
	CMSSchemaProperties,
	StorageAdapter,
	StorageBinary,
} from "./types";
