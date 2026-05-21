// ── キャッシュ ─────────────────────────────────────────────────────────
export { isStale, sha256Hex } from "./cache";
export type { MemoryCacheOptions } from "./cache/memory";
export { memoryCache } from "./cache/memory";
export { noopDocOps, noopImgOps } from "./cache/noop";
// ── メイン API ──────────────────────────────────────────────────────────
export type { CMSClient, CMSGlobalOps } from "./cms";
export { createClient } from "./cms";
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
export {
  CMSError,
  isCMSError,
  isCMSErrorInNamespace,
  matchCMSError,
} from "./errors";
// ── handler ────────────────────────────────────────────────────────────
export type { HandlerAdapter, HandlerOptions } from "./handler";
export { createHandler } from "./handler";
// ── フック・ロガー・プラグイン ────────────────────────────────────────
export { mergeHooks, mergeLoggers } from "./hooks";
// ── プリセット ─────────────────────────────────────────────────────────
export type { NodePresetOptions } from "./preset/node";
export { nodePreset } from "./preset/node";
// ── リトライ ───────────────────────────────────────────────────────────
export type { RetryConfig } from "./retry";
export { DEFAULT_RETRY_CONFIG, withRetry } from "./retry";
// ── 公開型 ──────────────────────────────────────────────────────────────
export type {
  AdjacencyOptions,
  BaseContentItem,
  CacheAdapter,
  CacheAdapterStats,
  CacheAreaStats,
  CachedItemContent,
  CachedItemList,
  CachedItemMeta,
  CheckResult,
  CMSHooks,
  CMSPlugin,
  CMSSchemaProperties,
  CollectionCacheOps,
  CollectionClient,
  ContentConfig,
  CreateClientOptions,
  DataSource,
  DocumentCacheOps,
  FindOptions,
  ImageCacheOps,
  InvalidateKind,
  InvalidateScope,
  ItemWithContent,
  ListOptions,
  LogContext,
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
  SWRConfig,
  WarmOptions,
  WarmResult,
  WebhookConfig,
} from "./types/index";
export { definePlugin } from "./types/plugin";
// ── データソース拡張ポイント (source-author サブパスからも export) ───
export type { CMSSources } from "./types/sources";
