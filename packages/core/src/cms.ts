import { noopDocOps, noopImgOps } from "./cache/noop";
import { CollectionClientImpl, type CollectionContext } from "./collection";
import { CMSError } from "./errors";
import { createHandler, type HandlerOptions } from "./handler";
import { mergeHooks, mergeLoggers, withTraceId } from "./hooks";
import { buildCacheImageFn } from "./image";
import type { RenderContext } from "./rendering";
import type { RetryConfig } from "./retry";
import { DEFAULT_RETRY_CONFIG } from "./retry";
import type {
  BaseContentItem,
  CacheAdapter,
  CacheAdapterStats,
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

/**
 * `cms.stats()` が返す集約済みキャッシュ統計。
 * 各 adapter の `stats()` 戻り値をそのまま配列で保持しつつ、ヒット率を算出する。
 */
export interface CMSStats {
  /** クライアント単位の trace ID (`createClient` で発行)。 */
  traceId: string;
  /** ドキュメントキャッシュの集計 (`handles: ["document"]` の adapter の `stats()` 戻り値)。 */
  document?: {
    adapter: string;
    hits: number;
    misses: number;
    entries?: number;
    sizeBytes?: number;
    /** 0〜1。`hits + misses === 0` のときは 0。 */
    hitRate: number;
  };
  /** 画像キャッシュの集計 (`handles: ["image"]` の adapter の `stats()` 戻り値)。 */
  image?: {
    adapter: string;
    hits: number;
    misses: number;
    entries?: number;
    sizeBytes?: number;
    hitRate: number;
  };
}

export interface CMSGlobalOps {
  readonly collections: readonly string[];
  /** クライアント単位の trace ID (`createClient` で発行)。 */
  readonly traceId: string;
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
  /**
   * ドキュメント / 画像キャッシュのヒット・ミス・サイズを集約して返す。
   * 各キャッシュアダプタの `stats()` を呼ぶだけで副作用はない。
   * `stats()` を実装していない adapter は集計から除外される (noop など)。
   */
  stats(): Promise<CMSStats>;
}

interface ResolvedCache {
  doc: DocumentCacheOps;
  docName: string;
  docAdapter: CacheAdapter | undefined;
  img: ImageCacheOps;
  imgName: string;
  imgAdapter: CacheAdapter | undefined;
  hasImg: boolean;
}

/**
 * adapter の `handles` を見て先勝ちで document / image を割り当てる。未指定は両方 noop。
 * `cms.stats()` から元 adapter の `stats()` を呼びたいので、解決元 adapter も保持する。
 */
function resolveCache(
  cache: readonly CacheAdapter[] | undefined,
): ResolvedCache {
  const adapters = cache ?? [];

  let doc: DocumentCacheOps = noopDocOps;
  let docName = "noop-document";
  let docAdapter: CacheAdapter | undefined;
  let img: ImageCacheOps = noopImgOps;
  let imgName = "noop-image";
  let imgAdapter: CacheAdapter | undefined;
  let docFound = false;
  let imgFound = false;

  for (const adapter of adapters) {
    if (!docFound && adapter.handles.includes("document") && adapter.doc) {
      doc = adapter.doc;
      docName = adapter.name;
      docAdapter = adapter;
      docFound = true;
    }
    if (!imgFound && adapter.handles.includes("image") && adapter.img) {
      img = adapter.img;
      imgName = adapter.name;
      imgAdapter = adapter;
      imgFound = true;
    }
  }

  return {
    doc,
    docName,
    docAdapter,
    img,
    imgName,
    imgAdapter,
    hasImg: imgFound,
  };
}

/**
 * 衝突しにくい短い trace ID を生成する。`{epoch36}-{rand36}` の 10〜12 文字程度。
 * core はゼロ依存ルールに従い node:crypto を静的 import しないため、Math.random ベースで十分。
 */
function generateTraceId(): string {
  const t = Date.now().toString(36);
  const r = Math.floor(Math.random() * 36 ** 6)
    .toString(36)
    .padStart(6, "0");
  return `${t}-${r}`;
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
export function createClient<S extends CMSSources = CMSSources>(
  opts: CreateClientOptions<S>,
): CMSClient<
  MergeSourceCollections<S> extends CollectionsConfig
    ? MergeSourceCollections<S>
    : CollectionsConfig
> {
  // sources の各アダプタが持つ collections をマージする
  const collectionsInput: CollectionsConfig = {};
  if (opts.sources) {
    for (const adapter of Object.values(
      opts.sources as unknown as Record<string, CMSAdapter | undefined>,
    )) {
      if (adapter) Object.assign(collectionsInput, adapter.collections);
    }
  }

  if (Object.keys(collectionsInput).length === 0) {
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
  // plugin logger と createClient 引数の logger を合成し、その上でクライアント単位の
  // traceId をログコンテキストに自動付与する。
  const baseLogger: Logger | undefined = mergeLoggers(
    opts.plugins ?? [],
    opts.logger,
  );
  const traceId = generateTraceId();
  const tracedLogger = withTraceId(baseLogger, traceId);
  const logger = opts.logLevel
    ? applyLogLevel(tracedLogger, opts.logLevel)
    : tracedLogger;
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

  const collectionNames: string[] = [];
  const collections: Record<string, CollectionClient<BaseContentItem>> = {};
  for (const [name, def] of Object.entries(collectionsInput)) {
    collectionNames.push(name);
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
    traceId,
    async stats(): Promise<CMSStats> {
      const stats: CMSStats = { traceId };
      // doc / img それぞれ、resolveCache が選んだ adapter にだけ stats() を要求する。
      // 同じ adapter が両方を担当している場合 (memoryCache など) は 1 回呼ぶだけで足りる。
      const adapterCache = new Map<CacheAdapter, Promise<CacheAdapterStats>>();
      const ensure = (
        adapter: CacheAdapter | undefined,
      ): Promise<CacheAdapterStats> | undefined => {
        if (!adapter?.stats) return undefined;
        const cached = adapterCache.get(adapter);
        if (cached) return cached;
        const fresh = adapter.stats();
        adapterCache.set(adapter, fresh);
        return fresh;
      };
      const docPromise = ensure(cacheRes.docAdapter);
      const imgPromise = ensure(cacheRes.imgAdapter);
      const computeHitRate = (h: number, m: number): number =>
        h + m === 0 ? 0 : h / (h + m);
      if (docPromise) {
        const docStats = await docPromise;
        if (docStats.doc) {
          stats.document = {
            adapter: docStats.name ?? cacheRes.docName,
            hits: docStats.doc.hits,
            misses: docStats.doc.misses,
            entries: docStats.doc.entries,
            sizeBytes: docStats.doc.sizeBytes,
            hitRate: computeHitRate(docStats.doc.hits, docStats.doc.misses),
          };
        }
      }
      if (imgPromise) {
        const imgStats = await imgPromise;
        if (imgStats.img) {
          stats.image = {
            adapter: imgStats.name ?? cacheRes.imgName,
            hits: imgStats.img.hits,
            misses: imgStats.img.misses,
            entries: imgStats.img.entries,
            sizeBytes: imgStats.img.sizeBytes,
            hitRate: computeHitRate(imgStats.img.hits, imgStats.img.misses),
          };
        }
      }
      return stats;
    },
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
          peekVersionFor(collection, slug) {
            const client = collections[collection];
            if (!client) {
              throw new CMSError({
                code: "handler/unknown_collection",
                message: `Unknown collection: ${collection}`,
                context: { operation: "peekVersionFor", collection, slug },
              });
            }
            return client.peekVersion(slug);
          },
          async checkFor(collection, slug, currentVersion) {
            const client = collections[collection];
            if (!client) {
              throw new CMSError({
                code: "handler/unknown_collection",
                message: `Unknown collection: ${collection}`,
                context: { operation: "checkFor", collection, slug },
              });
            }
            const result = await client.check(slug, currentVersion);
            // ItemWithContent は lazy 関数を含むため、HTTP には stale 判定のみ返す
            // （差分ありの場合 check() が副作用でキャッシュ更新済み。利用側は loader 再実行で本文取得）。
            return result === null ? null : { stale: result.stale };
          },
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
      : CollectionsConfig
  >;
}
