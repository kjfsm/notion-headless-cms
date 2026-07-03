import { Client } from "@notionhq/client";
import { CMSError } from "../errors.js";
import type {
  HttpHandlerAdapter,
  HttpHandlerOptions,
} from "../http/handler.js";
import { createFetchHandler } from "../http/handler.js";
import type { OgpHandlerOptions } from "../http/ogp.js";
import { createOgpHandler } from "../http/ogp.js";
import { createScheduledHandler } from "../http/scheduled.js";
import type { TransformStage } from "../pipeline/transform-stage.js";
import { findEntry } from "../query/find.js";
import type { ListRuntimeParams } from "../query/list.js";
import { listEntries } from "../query/list.js";
import type { SyncStats } from "../query/stats.js";
import { getSyncStats } from "../query/stats.js";
import { createEntryStore } from "../store/entry-store.js";
import { createIndexStore } from "../store/index-store.js";
import type { BlobStore, DocStore } from "../store/types.js";
import type { VersionedCacheLayer } from "../store/versioned-cache.js";
import { SyncCoordinatorCore } from "../sync/coordinator.js";
import { createMultiSourceDeps } from "../sync/multi-source.js";
import type { NotionClientLike } from "../sync/notion-driver.js";
import { createCollectionDriver } from "../sync/notion-driver.js";
import { buildPageIndex } from "../sync/page-index.js";
import { createRateLimiter } from "../sync/rate-limiter.js";
import type { RetryConfig } from "../sync/retry.js";
import type { SyncScheduler } from "../sync-scheduler.js";
import type {
  CollectionDef,
  CollectionMap,
  InferEntry,
  SchemaDef,
} from "../types/collection.js";
import type { IndexEntry } from "../types/collection-index.js";
import type { EntrySnapshot } from "../types/entry-snapshot.js";
import type { JsonValue } from "../types/json-value.js";
import type { ListParams, ListResult } from "../types/query.js";

const RESERVED_KEYS = ["sync", "fetch", "scheduled", "stats"] as const;

export interface CreateCMSNotionOptions {
  /** テスト・DO 内で共有インスタンスを注入する場合はこちら。指定時は `token` は無視される。 */
  readonly client?: NotionClientLike;
  /** 指定時は内部で `new Client({ auth: token })` を生成する。 */
  readonly token?: string;
}

export interface CreateCMSStoresOptions {
  readonly docs: DocStore;
  readonly blobs: BlobStore;
  readonly versionedCache?: VersionedCacheLayer;
}

export interface CreateCMSSyncOptions {
  /** 1 サイクルあたり処理する entry 数(コレクション横断の総量)。既定 2。 */
  readonly chunkSize?: number;
  readonly chunkDelayMs?: number;
  readonly debounceMs?: number;
  /** 全コレクションで共有する Notion API のレート上限。既定 3req/s。 */
  readonly requestsPerSecond?: number;
  readonly retry?: RetryConfig;
}

export interface CreateCMSOptions<S extends SchemaDef> {
  readonly schema: S;
  readonly notion: CreateCMSNotionOptions;
  readonly stores: CreateCMSStoresOptions;
  readonly scheduler: SyncScheduler;
  /** shiki/katex 等の事前レンダー拡張。省略時はページアクセス時のクライアント側レンダリングに委ねる。 */
  readonly transforms?: readonly TransformStage[];
  /** HTTP ハンドラのマウントパス。既定 `/api/cms`。 */
  readonly routes?: string;
  readonly imagesPath?: string;
  readonly webhookSecret?: string;
  readonly sync?: CreateCMSSyncOptions;
  /** OGP エンドポイントの設定。`false` で無効化。 */
  readonly ogp?: OgpHandlerOptions | false;
  readonly onVerificationToken?: (token: string) => void;
  readonly onRealtimeUpgrade?: HttpHandlerAdapter["onRealtimeUpgrade"];
  readonly onPreview?: HttpHandlerAdapter["onPreview"];
  readonly waitUntil?: (p: Promise<unknown>) => void;
}

/**
 * `EntrySnapshot<Meta extends JsonValue>` に `InferEntry<C>` を直接インスタンス化すると、
 * TS の「index signature の無いオブジェクト型は `JsonValue` を素朴には満たさない」という
 * 既知の制約（`types/json-value.ts` の `IsJsonValue` のコメント参照）に阻まれる。
 * 既定インスタンス化された `EntrySnapshot`（Meta = JsonValue）から `meta` を上書きする
 * 交差型にすることで、その制約チェックを経由せずに済ませる。
 */
export type CollectionEntrySnapshot<C extends CollectionDef> = Omit<
  EntrySnapshot,
  "meta"
> & {
  readonly meta: InferEntry<C>;
};

export interface CollectionHandle<C extends CollectionDef> {
  find(slug: string): Promise<CollectionEntrySnapshot<C> | null>;
  list(params?: ListParams<C["properties"]>): Promise<ListResult<IndexEntry>>;
}

type CollectionHandles<C extends CollectionMap> = {
  readonly [K in keyof C]: CollectionHandle<C[K]>;
};

export interface CMSSyncControls {
  kick(): Promise<void>;
  onWebhook(): Promise<void>;
  reconcile(): Promise<{ removed: readonly string[] }>;
  getState(): ReturnType<SyncCoordinatorCore["getState"]>;
  stats(): Promise<SyncStats>;
}

export type CMS<S extends SchemaDef> = CollectionHandles<S["collections"]> & {
  readonly sync: CMSSyncControls;
  fetch(request: Request): Promise<Response>;
  scheduled(): Promise<void>;
};

function resolveClient(notion: CreateCMSNotionOptions): NotionClientLike {
  if (notion.client) return notion.client;
  if (notion.token) {
    return new Client({ auth: notion.token }) as unknown as NotionClientLike;
  }
  throw new CMSError({
    code: "schema/notion_config_missing",
    message: "notion.client または notion.token のいずれかの指定が必要です",
    context: { operation: "createCMS" },
  });
}

function toRuntimeListParams(params: unknown): ListRuntimeParams {
  if (!params || typeof params !== "object") return {};
  const p = params as {
    where?: unknown;
    sort?: unknown;
    cursor?: string;
    limit?: number;
  };
  return {
    where: p.where as Record<string, Record<string, JsonValue>> | undefined,
    sort: p.sort as ListRuntimeParams["sort"],
    cursor: p.cursor,
    limit: p.limit,
  };
}

/**
 * v3 の利用者向けエントリポイント。schema の全コレクション分の Notion ドライバを
 * 組み立て、マルチソース合成 → `SyncCoordinatorCore` → HTTP ハンドラまでを
 * 一括結線する(#437)。
 *
 * ```ts
 * const cms = createCMS({
 *   schema,
 *   notion: { token: env.NOTION_TOKEN },
 *   stores: { docs: kvDocStore(env.DOC_INDEX), blobs: r2BlobStore(env.ENTRY_BUCKET) },
 *   scheduler,
 *   transforms: [createShikiTransform(), createKatexTransform()],
 * });
 * const post = await cms.posts.find(slug); // EntrySnapshot<InferEntry<...>> | null
 * ```
 */
export function createCMS<const S extends SchemaDef>(
  opts: CreateCMSOptions<S>,
): CMS<S> {
  const collectionKeys = Object.keys(opts.schema.collections);
  for (const reserved of RESERVED_KEYS) {
    if (collectionKeys.includes(reserved)) {
      throw new CMSError({
        code: "schema/reserved_collection_name",
        message: `コレクション名 "${reserved}" は予約済みのため使用できません`,
        context: { operation: "createCMS", collection: reserved },
      });
    }
  }
  for (const key of collectionKeys) {
    // multi-source.ts の namespacedSlug が ":" 区切りで collection/slug を合成するため、
    // collection キーに ":" を含むと異なるコレクション同士でキーが衝突しうる。
    if (key.includes(":")) {
      throw new CMSError({
        code: "schema/reserved_collection_name",
        message: `コレクション名 "${key}" に ":" を含めることはできません`,
        context: { operation: "createCMS", collection: key },
      });
    }
  }

  const client = resolveClient(opts.notion);
  const entryStore = createEntryStore(opts.stores.blobs);
  const indexStore = createIndexStore(opts.stores.docs);
  const rateLimiter = createRateLimiter({
    requestsPerSecond: opts.sync?.requestsPerSecond ?? 3,
  });
  const routes = opts.routes ?? "/api/cms";
  const imagesPath = opts.imagesPath ?? "/images";
  const pageIndex = () => buildPageIndex(opts.schema, indexStore);

  const drivers: Record<string, ReturnType<typeof createCollectionDriver>> = {};
  for (const collection of collectionKeys) {
    const def = opts.schema.collections[collection];
    if (!def) continue;
    drivers[collection] = createCollectionDriver({
      collection,
      def,
      client,
      rateLimiter,
      retry: opts.sync?.retry,
      entryStore,
      indexStore,
      blobs: opts.stores.blobs,
      transforms: opts.transforms,
      imagesPath,
      pageIndex,
    });
  }

  const multiSourceDeps = createMultiSourceDeps({ drivers });
  const coordinator = new SyncCoordinatorCore(opts.scheduler, {
    ...multiSourceDeps,
    chunkSize: opts.sync?.chunkSize,
    chunkDelayMs: opts.sync?.chunkDelayMs,
    debounceMs: opts.sync?.debounceMs,
  });

  // CollectionHandle<C> は公開 API の型（InferEntry<C> による厳密な型推論）を表現するが、
  // C は createCMS<S> の中では未解決の型変数のため、ここでは型消去して構築し、
  // 呼び出し境界（return 文の `as CMS<S>`）でまとめて公開型に確定させる。
  const collections: Record<
    string,
    {
      find: (slug: string) => Promise<unknown>;
      list: (params?: unknown) => Promise<ListResult<IndexEntry>>;
    }
  > = {};
  for (const collection of collectionKeys) {
    collections[collection] = {
      async find(slug: string) {
        return findEntry(
          {
            entryStore,
            indexStore,
            versionedCache: opts.stores.versionedCache,
          },
          collection,
          slug,
        );
      },
      async list(params?: unknown) {
        return listEntries(indexStore, collection, toRuntimeListParams(params));
      },
    };
  }

  const httpAdapter: HttpHandlerAdapter = {
    images: opts.stores.blobs,
    webhookSecret: opts.webhookSecret,
    onVerificationToken: opts.onVerificationToken,
    onWebhookEvent: () => coordinator.onWebhook(),
    onRealtimeUpgrade: opts.onRealtimeUpgrade,
    onPreview: opts.onPreview,
    onOgp: opts.ogp === false ? undefined : createOgpHandler(opts.ogp),
    waitUntil: opts.waitUntil,
  };
  const httpOptions: HttpHandlerOptions = { routes };
  const fetchHandler = createFetchHandler(httpAdapter, httpOptions);
  const scheduledHandler = createScheduledHandler(coordinator);

  const sync: CMSSyncControls = {
    kick: () => coordinator.kick(),
    onWebhook: () => coordinator.onWebhook(),
    reconcile: () => coordinator.reconcile(),
    getState: () => coordinator.getState(),
    stats: () => getSyncStats(opts.scheduler),
  };

  return {
    ...collections,
    sync,
    fetch: fetchHandler,
    scheduled: scheduledHandler,
  } as unknown as CMS<S>;
}
