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
import { createLeveledLogger } from "../logger.js";
import type { TransformStage } from "../pipeline/transform-stage.js";
import type { ColdStartFetch } from "../query/find.js";
import { findEntry } from "../query/find.js";
import type { ListRuntimeParams } from "../query/list.js";
import { listEntries } from "../query/list.js";
import type { SyncStats } from "../query/stats.js";
import { getSyncStats } from "../query/stats.js";
import type { RealtimeAdapter } from "../realtime.js";
import { createEntryStore } from "../store/entry-store.js";
import { createIndexStore } from "../store/index-store.js";
import { memoryBlobStore, memoryDocStore } from "../store/memory.js";
import type { BlobStore, DocStore } from "../store/types.js";
import type { VersionedCacheLayer } from "../store/versioned-cache.js";
import type { SyncState } from "../sync/coordinator.js";
import { SyncCoordinatorCore } from "../sync/coordinator.js";
import { createMultiSourceDeps } from "../sync/multi-source.js";
import { createNodeSyncScheduler } from "../sync/node-scheduler.js";
import type { NotionClientLike } from "../sync/notion-driver.js";
import { createCollectionDriver } from "../sync/notion-driver.js";
import { createMemoizedPageIndex } from "../sync/page-index.js";
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
import type { Logger, LogLevel } from "../types/logger.js";
import type { ListParams, ListResult } from "../types/query.js";

const RESERVED_KEYS = ["sync", "fetch", "scheduled"] as const;

export interface CreateCMSNotionOptions {
  /** テスト・DO 内で共有インスタンスを注入する場合はこちら。指定時は `token` は無視される。 */
  readonly client?: NotionClientLike;
  /** 指定時は内部で `new Client({ auth: token })` を生成する。 */
  readonly token?: string;
}

export interface CreateCMSStoresOptions {
  /** index 用ストア。省略時は in-memory（`memoryDocStore()`）にフォールバックする。 */
  readonly docs?: DocStore;
  /** entry 本体・画像用ストア。省略時は in-memory（`memoryBlobStore()`）にフォールバックする。 */
  readonly blobs?: BlobStore;
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
  /** KV write の日次ソフト上限（予算計測の基準値）。既定 1000（無料枠）。 */
  readonly dailyWriteBudget?: number;
  /** ソフト上限に対する警告発火の割合（0〜1）。既定 0.8。 */
  readonly writeBudgetWarnRatio?: number;
}

/**
 * sync 制御を外部（Durable Object 等）に委譲する場合の差し替え口。指定時は
 * `notion`/`scheduler` を使ったローカルの `SyncCoordinatorCore` 構築を丸ごとスキップし、
 * `sync.*` と webhook/scheduled ハンドラをすべてこちらに委譲する。
 *
 * 用途: 無料プランの読者用 stateless Worker は KV/R2 の読み取りのみ行い、Notion API への
 * 直列アクセスは `SyncCoordinatorDO`（`@notion-headless-cms/cms/cloudflare`）に一元化したい場合。
 * `durableObjectSyncDelegate(stub)` が DO stub への転送実装を提供する。
 */
export interface CMSSyncDelegate {
  kick(): Promise<void>;
  onWebhook(): Promise<void>;
  reconcile(): Promise<{ removed: readonly string[] }>;
  getState(): Promise<SyncState | null>;
  stats(): Promise<SyncStats>;
}

export interface CreateCMSOptions<S extends SchemaDef> {
  readonly schema: S;
  /**
   * ストレージ。省略した slot は in-memory 実装にフォールバックするため、KV/R2 バインディングが
   * 無い環境（ローカル・プレビュー等）でも動作する。KV/R2 を渡すと永続化・高速化される。
   */
  readonly stores?: CreateCMSStoresOptions;
  /** `syncDelegate` 未指定時は必須（ローカルで `SyncCoordinatorCore` を組み立てるため）。 */
  readonly notion?: CreateCMSNotionOptions;
  /** 省略時は `createNodeSyncScheduler()`（`setTimeout` ベース）にフォールバックする。 */
  readonly scheduler?: SyncScheduler;
  /** 同期完了時に version 同梱で push する（#437 ADR-5）。省略時は push しない。 */
  readonly realtime?: RealtimeAdapter;
  /** 指定時は notion/scheduler によるローカル同期を行わず、こちらに委譲する。 */
  readonly syncDelegate?: CMSSyncDelegate;
  /**
   * index/entry が未マテリアライズの場合のみ、1 回だけブロッキング取得するフォールバック
   * (#442)。既定では `find()` は未マテリアライズなら Notion を呼ばず null を返す
   * (「読者リクエスト処理中は Notion API を呼ばない」という北極星どおり)。
   * `syncDelegate` 経由(DO 等)で同等の read-through を行いたい場合はここに明示的に渡す。
   */
  readonly coldStartFetch?: ColdStartFetch;
  /**
   * `true` の場合、`notion` によるローカル同期(`syncDelegate` 未指定時)で各コレクション
   * ドライバの `retrieveBySlug` を自動的にコールドスタートフォールバックとして使う
   * (#442)。既定は無効(未マテリアライズな `find()` は null を返す)。`coldStartFetch` を
   * 明示的に渡した場合はそちらが優先される。
   */
  readonly coldStart?: boolean;
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
  /** 同期・配信経路の構造化ログ出力先。未指定ならログを出さない。 */
  readonly logger?: Logger;
  /** `logger` の下限レベル。指定レベル未満を抑制する。既定は全レベル出力。 */
  readonly logLevel?: LogLevel;
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

/**
 * `find()` の `CollectionEntrySnapshot<C>` と同じ扱いを `list()` にも与える型。
 * `IndexEntry.meta`(`JsonValue`)を当該コレクションの `InferEntry<C>` に絞り込む。
 * ドライバ(`notion-driver.ts` の `syncEntry`)が index にも full meta を書き込むため、
 * この絞り込みは実データと一致する（`collection-index.ts` の不変条件コメント参照）。
 */
export type CollectionIndexEntry<C extends CollectionDef> = Omit<
  IndexEntry,
  "meta"
> & {
  readonly meta: InferEntry<C>;
};

export interface CollectionHandle<C extends CollectionDef> {
  /**
   * slug でエントリを取得する。`slug` プロパティを設定していないコレクションでは
   * キーが Notion の page id になるため、`find(pageId)` で取得する。
   */
  find(slug: string): Promise<CollectionEntrySnapshot<C> | null>;
  list(
    params?: ListParams<C["properties"]>,
  ): Promise<ListResult<CollectionIndexEntry<C>>>;
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
 *
 * `stores`/`scheduler` は省略でき、その場合は in-memory ストア（`memoryDocStore()`/
 * `memoryBlobStore()`）と `createNodeSyncScheduler()` にフォールバックする。KV/R2/DO が
 * 無い環境でも最低限動作し（cold start ごとに Notion から再同期・永続なし）、バインディングを
 * 足すと永続化・高速化される。
 *
 * ```ts
 * // 最小構成（KV/R2/DO 無し）: Notion トークンだけで動く
 * const cms = createCMS({ schema, notion: { token: env.NOTION_TOKEN } });
 * await cms.sync.kick();
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

  const docs = opts.stores?.docs ?? memoryDocStore();
  const blobs = opts.stores?.blobs ?? memoryBlobStore();
  const versionedCache = opts.stores?.versionedCache;
  const logger = createLeveledLogger(opts.logger, opts.logLevel);
  const entryStore = createEntryStore(blobs);
  const indexStore = createIndexStore(docs, logger);
  const routes = opts.routes ?? "/api/cms";
  const imagesPath = opts.imagesPath ?? "/images";
  // buildPageIndex は全コレクションの manifest を丸ごと読み直す重い処理なので、
  // manifest への実書き込みが無い限りキャッシュを使い回す(#11)。ドライバには
  // 無効化を発火できる driverIndexStore を渡す(素の indexStore だと無効化が効かない)。
  const { pageIndex, indexStore: driverIndexStore } = createMemoizedPageIndex(
    opts.schema,
    indexStore,
  );

  let sync: CMSSyncControls;
  let onWebhookEvent: () => Promise<void> | void;
  let scheduledHandler: () => Promise<void>;
  // opts.coldStart(既定 false)かつローカル同期時のみ、各コレクションドライバの
  // retrieveBySlug を使ったコールドスタートフォールバックを配線する。
  let localColdStartFetch: ColdStartFetch | undefined;

  if (opts.syncDelegate) {
    // sync 制御は DO 等の外部委譲先に一任し、ローカルの SyncCoordinatorCore は作らない
    // （notion/scheduler 未指定でも read-only な Worker として動作させたい用途）。
    const delegate = opts.syncDelegate;
    sync = {
      kick: () => delegate.kick(),
      onWebhook: () => delegate.onWebhook(),
      reconcile: () => delegate.reconcile(),
      getState: async () =>
        (await delegate.getState()) ?? {
          cursor: null,
          lastSyncAt: null,
          lastReconcileAt: null,
          failures: [],
        },
      stats: () => delegate.stats(),
    };
    onWebhookEvent = () => delegate.onWebhook();
    scheduledHandler = async () => {
      await delegate.reconcile();
    };
  } else {
    if (!opts.notion) {
      throw new CMSError({
        code: "schema/notion_config_missing",
        message:
          "notion.client または notion.token のいずれかの指定が必要です（もしくは syncDelegate を指定してください）",
        context: { operation: "createCMS" },
      });
    }
    const client = resolveClient(opts.notion);
    const scheduler = opts.scheduler ?? createNodeSyncScheduler();
    const rateLimiter = createRateLimiter({
      requestsPerSecond: opts.sync?.requestsPerSecond ?? 3,
    });

    const drivers: Record<
      string,
      ReturnType<typeof createCollectionDriver>
    > = {};
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
        indexStore: driverIndexStore,
        blobs,
        transforms: opts.transforms,
        imagesPath,
        pageIndex,
        realtime: opts.realtime,
        logger,
      });
    }

    if (opts.coldStart) {
      localColdStartFetch = async (collection, slug) => {
        const driver = drivers[collection];
        return driver ? driver.retrieveBySlug(slug) : null;
      };
    }

    const multiSourceDeps = createMultiSourceDeps({ drivers, logger });
    const coordinator = new SyncCoordinatorCore(scheduler, {
      ...multiSourceDeps,
      chunkSize: opts.sync?.chunkSize,
      chunkDelayMs: opts.sync?.chunkDelayMs,
      debounceMs: opts.sync?.debounceMs,
      dailyWriteBudget: opts.sync?.dailyWriteBudget,
      writeBudgetWarnRatio: opts.sync?.writeBudgetWarnRatio,
      logger,
    });

    sync = {
      kick: () => coordinator.kick(),
      onWebhook: () => coordinator.onWebhook(),
      reconcile: () => coordinator.reconcile(),
      getState: () => coordinator.getState(),
      stats: () => getSyncStats(scheduler),
    };
    onWebhookEvent = () => coordinator.onWebhook();
    scheduledHandler = createScheduledHandler(coordinator);
  }

  const coldStartFetch = opts.coldStartFetch ?? localColdStartFetch;

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
            versionedCache,
            coldStartFetch,
            logger,
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
    images: blobs,
    webhookSecret: opts.webhookSecret,
    onVerificationToken: opts.onVerificationToken,
    onWebhookEvent,
    onRealtimeUpgrade: opts.onRealtimeUpgrade,
    onPreview: opts.onPreview,
    onOgp: opts.ogp === false ? undefined : createOgpHandler(opts.ogp),
    waitUntil: opts.waitUntil,
    logger,
  };
  const httpOptions: HttpHandlerOptions = { routes };
  const fetchHandler = createFetchHandler(httpAdapter, httpOptions);

  return {
    ...collections,
    sync,
    fetch: fetchHandler,
    scheduled: scheduledHandler,
  } as unknown as CMS<S>;
}
