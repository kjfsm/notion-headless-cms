// ── キャッシュ ─────────────────────────────────────────────────────────
export { isStale, sha256Hex } from "./cache";
export type { MemoryCacheOptions } from "./cache/memory";
export { memoryCache } from "./cache/memory";
export { noopDocOps, noopImgOps } from "./cache/noop";
// ── メイン API ──────────────────────────────────────────────────────────
export type { CMSClient, CMSGlobalOps } from "./cms";
export { createCMS } from "./cms";
// ── コレクション ─────────────────────────────────────────────────────────
export type { CollectionContext } from "./collection";
export { CollectionClientImpl, collectionKey } from "./collection";
// ── コンテンツ AST ──────────────────────────────────────────────────────
export type {
  ContentBlock,
  ContentResult,
  ImageRef,
  InlineNode,
} from "./content/blocks";
// ── エラー ──────────────────────────────────────────────────────────────
export type {
  BuiltInCMSErrorCode,
  CMSErrorCode,
  CMSErrorContext,
} from "./errors";
export { CMSError, isCMSError, isCMSErrorInNamespace } from "./errors";
// ── $handler ───────────────────────────────────────────────────────────
export type { HandlerAdapter, HandlerOptions } from "./handler";
export { createHandler } from "./handler";
// ── フック・ロガー・プラグイン ────────────────────────────────────────
export { mergeHooks, mergeLoggers } from "./hooks";
// ── リトライ ───────────────────────────────────────────────────────────
export type { RetryConfig } from "./retry";
export { DEFAULT_RETRY_CONFIG, withRetry } from "./retry";
// ── 公開型 ──────────────────────────────────────────────────────────────
export type {
  AdjacencyOptions,
  BaseContentItem,
  CacheAdapter,
  CachedItemContent,
  CachedItemList,
  CachedItemMeta,
  CheckResult,
  CMSHooks,
  CMSPlugin,
  CMSSchemaProperties,
  CollectionCacheOps,
  CollectionClient,
  CollectionDef,
  CollectionsConfig,
  ContentConfig,
  CreateCMSOptions,
  DataSource,
  DocumentCacheOps,
  GetOptions,
  ImageCacheOps,
  InferCollectionItem,
  InvalidateKind,
  InvalidateScope,
  ItemWithRender,
  ListOptions,
  Logger,
  LogLevel,
  MaybePromise,
  PropertyDef,
  PropertyMap,
  RateLimiterConfig,
  RendererFn,
  RendererPluginList,
  RenderOptions,
  SortOption,
  StorageBinary,
  WarmOptions,
  WebhookConfig,
} from "./types/index";
export { definePlugin } from "./types/plugin";
