import { noopDocOps, noopImgOps } from "./cache/noop";
import { CollectionClientImpl, type CollectionContext } from "./collection";
import { CMSError } from "./errors";
import { createHandler, type HandlerOptions } from "./handler";
import { mergeHooks, mergeLoggers } from "./hooks";
import { buildCacheImageFn } from "./image";
import type { RenderContext } from "./rendering";
import type { RetryConfig } from "./retry";
import { DEFAULT_RETRY_CONFIG } from "./retry";
import type {
  BaseContentItem,
  CacheAdapter,
  CMSHooks,
  CollectionClient,
  CollectionsConfig,
  CreateClientOptions,
  DataSource,
  DocumentCacheOps,
  ImageCacheOps,
  InferCollectionItem,
  InvalidateScope,
  Logger,
  LogLevel,
  RendererFn,
  StorageBinary,
} from "./types/index";
import type {
  CMSAdapter,
  CMSSources,
  MergeSourceCollections,
} from "./types/sources";

const DEFAULT_IMAGE_PROXY_BASE = "/api/images";

/** コレクション別アクセス + グローバル操作の合成型。 */
export type CMSClient<C extends CollectionsConfig> = {
  [K in keyof C]: CollectionClient<InferCollectionItem<C[K]>>;
} & CMSGlobalOps;

export interface CMSGlobalOps {
  readonly collections: readonly string[];
  invalidate(scope?: InvalidateScope): Promise<void>;
  /** Web Standard な Request/Response ベースのルートハンドラ (画像プロキシ + webhook)。 */
  handler(opts?: HandlerOptions): (req: Request) => Promise<Response>;
  getCachedImage(hash: string): Promise<StorageBinary | null>;
  /**
   * Notion 画像 URL を `{imageProxyBase}/{sha256}` 形式へ変換しキャッシュへ書き込む。
   * 画像キャッシュが未設定 (noop) の場合は `undefined`。
   */
  readonly cacheImage: ((url: string) => Promise<string>) | undefined;
  readonly imageProxyBase: string;
}

interface ResolvedCache {
  doc: DocumentCacheOps;
  docName: string;
  img: ImageCacheOps;
  imgName: string;
  hasImg: boolean;
}

/**
 * adapter の `handles` を見て先勝ちで document / image を割り当てる。未指定は両方 noop。
 */
function resolveCache(
  cache: readonly CacheAdapter[] | undefined,
): ResolvedCache {
  const adapters = cache ?? [];

  let doc: DocumentCacheOps = noopDocOps;
  let docName = "noop-document";
  let img: ImageCacheOps = noopImgOps;
  let imgName = "noop-image";
  let docFound = false;
  let imgFound = false;

  for (const adapter of adapters) {
    if (!docFound && adapter.handles.includes("document") && adapter.doc) {
      doc = adapter.doc;
      docName = adapter.name;
      docFound = true;
    }
    if (!imgFound && adapter.handles.includes("image") && adapter.img) {
      img = adapter.img;
      imgName = adapter.name;
      imgFound = true;
    }
  }

  return { doc, docName, img, imgName, hasImg: imgFound };
}

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function applyLogLevel(
  logger: Logger | undefined,
  minLevel: LogLevel,
): Logger | undefined {
  if (!logger) return undefined;
  const minOrder = LOG_LEVEL_ORDER[minLevel];
  const filtered: Logger = {};
  for (const level of ["debug", "info", "warn", "error"] as const) {
    if (LOG_LEVEL_ORDER[level] >= minOrder) {
      filtered[level] = logger[level];
    }
  }
  return filtered;
}

/**
 * CMS クライアントを生成する。
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
 *
 * const posts = await cms.posts.list();
 */
export function createClient<
  C extends CollectionsConfig = CollectionsConfig,
  S extends CMSSources = CMSSources,
>(
  opts: CreateClientOptions<C, S>,
): CMSClient<
  MergeSourceCollections<S> extends CollectionsConfig
    ? MergeSourceCollections<S>
    : C
> {
  // sources を渡された場合は後勝ちで collections にマージする
  let mergedFromSources: CollectionsConfig | undefined;
  if (opts.sources) {
    mergedFromSources = {};
    for (const adapter of Object.values(
      opts.sources as unknown as Record<string, CMSAdapter | undefined>,
    )) {
      if (adapter) Object.assign(mergedFromSources, adapter.collections);
    }
  }
  const collectionsInput: CollectionsConfig | undefined =
    mergedFromSources ?? opts.collections;

  if (!collectionsInput || Object.keys(collectionsInput).length === 0) {
    throw new CMSError({
      code: "core/config_invalid",
      message:
        "createClient: sources に少なくとも 1 つのコレクションを指定してください。",
      context: { operation: "createClient" },
      nextSteps: [
        "notionSource({ schema, token }) を sources.notion に渡す",
        "`nhc generate` でスキーマを生成してから import する",
      ],
      docsUrl:
        "https://github.com/kjfsm/notion-headless-cms/blob/main/docs/quickstart.md",
    });
  }

  for (const [name, def] of Object.entries(collectionsInput)) {
    if (!def.source) {
      throw new CMSError({
        code: "core/config_invalid",
        message: `createClient: コレクション "${name}" の source は必須です。`,
        context: { operation: "createClient", collection: name },
        nextSteps: ["notionSource(...) を sources に渡しているか確認する"],
      });
    }
    if (!def.slugField) {
      throw new CMSError({
        code: "core/config_invalid",
        message: `createClient: コレクション "${name}" の slugField は必須です。`,
        context: { operation: "createClient", collection: name },
        nextSteps: [
          `nhc.config.ts の ${name} コレクションに slugField を設定する`,
        ],
      });
    }
  }

  const cacheRes = resolveCache(opts.cache);
  const ttlMs = opts.swr?.ttlMs;
  const imageProxyBase = opts.imageProxyBase ?? DEFAULT_IMAGE_PROXY_BASE;
  const contentConfig = opts.content;
  const rendererFn: RendererFn | undefined = opts.renderer;
  const waitUntil = opts.waitUntil;
  const baseLogger: Logger | undefined = mergeLoggers(
    opts.plugins ?? [],
    opts.logger,
  );
  const logger = opts.logLevel
    ? applyLogLevel(baseLogger, opts.logLevel)
    : baseLogger;
  const hooks: CMSHooks<BaseContentItem> = mergeHooks(
    opts.plugins ?? [],
    opts.hooks,
    logger,
  );
  const maxConcurrent = opts.rateLimiter?.maxConcurrent ?? 3;
  const retryConfig: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...(opts.rateLimiter ?? {}),
  };

  const collectionNames: (keyof C & string)[] = [];
  const collections: Record<string, CollectionClient<BaseContentItem>> = {};
  for (const [name, def] of Object.entries(collectionsInput)) {
    collectionNames.push(name as keyof C & string);
    const source = def.source as DataSource<BaseContentItem>;
    const colHooks = def.hooks as CMSHooks<BaseContentItem> | undefined;
    const collectionHooks: CMSHooks<BaseContentItem> = colHooks
      ? mergeHooks([{ name: `${name}:global`, hooks }], colHooks, logger)
      : hooks;
    const renderCtx: RenderContext<BaseContentItem> = {
      source,
      rendererFn,
      imgCache: cacheRes.img,
      imgCacheName: cacheRes.imgName,
      hasImageCache: cacheRes.hasImg,
      imageProxyBase,
      contentConfig,
      hooks: collectionHooks,
      logger,
    };
    const ctx: CollectionContext<BaseContentItem> = {
      collection: name,
      source,
      docCache: cacheRes.doc,
      docCacheName: cacheRes.docName,
      render: renderCtx,
      hooks: collectionHooks,
      logger,
      ttlMs,
      publishedStatuses: def.publishedStatuses
        ? [...def.publishedStatuses]
        : [],
      accessibleStatuses: def.accessibleStatuses
        ? [...def.accessibleStatuses]
        : [],
      retryConfig,
      maxConcurrent,
      waitUntil,
      slugField: def.slugField,
    };
    collections[name] = new CollectionClientImpl(ctx);
  }

  const cacheImage = cacheRes.hasImg
    ? buildCacheImageFn(cacheRes.img, cacheRes.imgName, imageProxyBase, logger)
    : undefined;

  const globalOps: CMSGlobalOps = {
    collections: collectionNames,
    cacheImage,
    imageProxyBase,
    async invalidate(scope?: InvalidateScope): Promise<void> {
      logger?.debug?.("グローバルキャッシュを無効化", {
        operation: "invalidate",
        cacheAdapter: cacheRes.docName,
      });
      await cacheRes.doc.invalidate(scope ?? "all");
    },
    handler(handlerOpts?: HandlerOptions) {
      return createHandler(
        {
          imageCache: cacheRes.img,
          async parseWebhookFor(collection, req, webhookSecret) {
            const def = collectionsInput[collection];
            if (!def) {
              throw new CMSError({
                code: "webhook/unknown_collection",
                message: `Unknown collection: ${collection}`,
                context: { operation: "parseWebhookFor", collection },
              });
            }
            const ds = def.source as DataSource<BaseContentItem>;
            if (!ds.parseWebhook) {
              throw new CMSError({
                code: "webhook/not_implemented",
                message: `Collection "${collection}" does not support webhooks.`,
                context: { operation: "parseWebhookFor", collection },
              });
            }
            return ds.parseWebhook(req, { secret: webhookSecret });
          },
          revalidate: (scope) => globalOps.invalidate(scope),
        },
        handlerOpts,
      );
    },
    getCachedImage(hash) {
      return cacheRes.img.get(hash);
    },
  };

  return Object.assign(
    Object.create(null) as object,
    collections,
    globalOps,
  ) as CMSClient<
    MergeSourceCollections<S> extends CollectionsConfig
      ? MergeSourceCollections<S>
      : C
  >;
}
