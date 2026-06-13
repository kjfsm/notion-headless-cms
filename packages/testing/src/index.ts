/**
 * `@notion-headless-cms/testing`
 *
 * 利用側のユニットテスト / 結合テストで、Notion API や永続キャッシュを叩かずに
 * `createClient` が組んだ CMSClient と同じ public API をそのまま動かすためのユーティリティ。
 *
 * 提供する API:
 *
 * - `createFakeNotionSource(opts)` — 任意の items 配列から CMSAdapter を組み立てる
 * - `createFakeCache()` — メモリ実装の CacheAdapter (memoryCache() 相当 + テスト用 dump ヘルパ)
 * - `createFixtureClient(opts)` — fake source / fake cache / fake renderer を自動配線する createClient
 *
 * ゼロ依存ルールに従い、ランタイム依存は `@notion-headless-cms/core` のみ。
 * markdown-html / notion-orm / notionhq client を必要としない。
 */
import {
  type BaseContentItem,
  type CacheAdapter,
  type CachedItemContent,
  type CachedItemList,
  type CachedItemMeta,
  type CMSClient,
  type CMSSources,
  type CreateClientOptions,
  createClient as coreCreateClient,
  type DataSource,
  type DocumentCacheOps,
  type ImageCacheOps,
  type InvalidateScope,
  type RendererFn,
  type StorageBinary,
} from "@notion-headless-cms/core";
import type {
  CMSAdapter,
  CollectionDef,
  CollectionsConfig,
} from "@notion-headless-cms/core/source-author";

/** 1 コレクションぶんの fake 設定。 */
export interface FakeCollectionConfig<
  T extends BaseContentItem = BaseContentItem,
> {
  /** このコレクションが返す items。 */
  items: readonly T[];
  /** slug プロパティ名。デフォルト "slug"。 */
  slugField?: string;
  /** ステータスプロパティ名。デフォルト "status"。 */
  statusField?: string;
  /** 公開扱いするステータス。`list()` のデフォルトフィルタに使う。 */
  publishedStatuses?: readonly string[];
  /** アクセス許可ステータス。 */
  accessibleStatuses?: readonly string[];
  /** `loadMarkdown(item)` のオーバーライド。デフォルトは `# {title ?? slug}`。 */
  loadMarkdown?: (item: T) => string | Promise<string>;
  /** `loadBlocks(item)` のオーバーライド。デフォルトは `[]`。 */
  loadBlocks?: (item: T) => unknown[] | Promise<unknown[]>;
  /** `loadNotionBlocks(item)` のオーバーライド。未指定なら DataSource では未実装扱い。 */
  loadNotionBlocks?: (item: T) => unknown[] | Promise<unknown[]>;
}

/** `createFakeNotionSource` の入力。 */
export interface CreateFakeNotionSourceOptions<
  T extends BaseContentItem = BaseContentItem,
> {
  /**
   * 単一コレクション (`posts`) を作る簡易フォーム。
   * 複数コレクションが必要な場合は `collections` を使う。
   */
  items?: readonly T[];
  /**
   * 複数コレクションを明示的に組み立てる詳細フォーム。
   * `items` と同時指定した場合は `collections` が優先される。
   */
  collections?: Record<string, FakeCollectionConfig<T>>;
}

/**
 * 任意の items 配列から `CMSAdapter` を生成する。
 * `createClient({ sources: { notion: createFakeNotionSource({ items }) } })` の形で使う。
 *
 * `items` 単一指定の場合、コレクション名は `posts` 固定。
 */
export function createFakeNotionSource<T extends BaseContentItem>(options: {
  items: readonly T[];
}): CMSAdapter<{ posts: CollectionDef<T> }>;
export function createFakeNotionSource<T extends BaseContentItem>(options: {
  collections: Record<string, FakeCollectionConfig<T>>;
}): CMSAdapter<CollectionsConfig>;
export function createFakeNotionSource(
  options?: CreateFakeNotionSourceOptions<BaseContentItem>,
): CMSAdapter<CollectionsConfig>;
export function createFakeNotionSource(
  options: CreateFakeNotionSourceOptions<BaseContentItem> = {},
): CMSAdapter<CollectionsConfig> {
  const collections: Record<
    string,
    FakeCollectionConfig<BaseContentItem>
  > = options.collections ??
  (options.items ? { posts: { items: options.items } } : {});

  const result: Record<string, CollectionDef<BaseContentItem>> = {};
  for (const [name, cfg] of Object.entries(collections)) {
    const def: CollectionDef<BaseContentItem> = {
      source: makeFakeDataSource(name, cfg),
      slugField: cfg.slugField ?? "slug",
    };
    if (cfg.statusField !== undefined) def.statusField = cfg.statusField;
    if (cfg.publishedStatuses !== undefined)
      def.publishedStatuses = cfg.publishedStatuses;
    if (cfg.accessibleStatuses !== undefined)
      def.accessibleStatuses = cfg.accessibleStatuses;
    result[name] = def;
  }

  return { collections: result };
}

function makeFakeDataSource<T extends BaseContentItem>(
  name: string,
  cfg: FakeCollectionConfig<T>,
): DataSource<T> {
  const slugField = cfg.slugField ?? "slug";
  const items = cfg.items;

  // BaseContentItem の archive 系フラグでデフォルト除外する。
  // notion-orm の実装と整合する: list() は isArchived/isInTrash でない items を返す。
  const visibleItems = items.filter((it) => !it.isArchived && !it.isInTrash);

  return {
    name: `fake:${name}`,
    list: (opts) => {
      const allow = opts?.publishedStatuses;
      if (!allow || allow.length === 0) {
        return Promise.resolve([...visibleItems]);
      }
      const set = new Set(allow);
      return Promise.resolve(
        visibleItems.filter((it) => it.status != null && set.has(it.status)),
      );
    },
    findByProp: (prop, value) => {
      if (prop !== slugField && prop !== "slug") {
        for (const it of items) {
          const v = (it as unknown as Record<string, unknown>)[prop];
          if (v === value) return Promise.resolve(it);
        }
        return Promise.resolve(null);
      }
      return Promise.resolve(items.find((it) => it.slug === value) ?? null);
    },
    loadMarkdown: async (item) =>
      cfg.loadMarkdown
        ? cfg.loadMarkdown(item)
        : `# ${item.title ?? item.slug}\n`,
    loadBlocks: async (item) =>
      (cfg.loadBlocks ? cfg.loadBlocks(item) : []) as never,
    ...(cfg.loadNotionBlocks
      ? {
          loadNotionBlocks: async (item: T) =>
            (cfg.loadNotionBlocks as (it: T) => Promise<unknown[]>)(item),
        }
      : {}),
    getLastModified: (item) => item.lastEditedTime,
    getListVersion: (xs) =>
      xs.length === 0
        ? ""
        : xs.map((it) => it.lastEditedTime).reduce((a, b) => (a > b ? a : b)),
  } satisfies DataSource<T>;
}

/** `createFakeCache()` のオプション。 */
export interface CreateFakeCacheOptions {
  /** Adapter 名。複数の fake cache を区別するときに使う。デフォルト "fake-cache"。 */
  name?: string;
}

/**
 * テスト用 in-memory CacheAdapter。
 * `memoryCache()` と等価な動作をするが、`dump()` でストレージ内容を覗ける拡張あり。
 */
export interface FakeCacheAdapter extends CacheAdapter {
  /** 内部ストレージの中身を覗くテスト用 helper。 */
  readonly dump: () => {
    lists: ReadonlyMap<string, CachedItemList<BaseContentItem>>;
    metas: ReadonlyMap<string, CachedItemMeta<BaseContentItem>>;
    contents: ReadonlyMap<string, CachedItemContent>;
    images: ReadonlyMap<string, StorageBinary>;
  };
}

/**
 * テスト用の fake CacheAdapter を返す。
 * document / image 両方を担当する。状態は in-memory で、`adapter.dump()` で参照できる。
 */
export function createFakeCache(
  options: CreateFakeCacheOptions = {},
): FakeCacheAdapter {
  const lists = new Map<string, CachedItemList<BaseContentItem>>();
  const metas = new Map<string, CachedItemMeta<BaseContentItem>>();
  const contents = new Map<string, CachedItemContent>();
  const images = new Map<string, StorageBinary>();

  const key = (collection: string, slug: string) => `${collection}:${slug}`;

  const doc: DocumentCacheOps = {
    getList: <T extends BaseContentItem>(collection: string) =>
      Promise.resolve(
        (lists.get(collection) as CachedItemList<T> | undefined) ?? null,
      ),
    setList: <T extends BaseContentItem>(
      collection: string,
      data: CachedItemList<T>,
    ) => {
      lists.set(collection, data as unknown as CachedItemList<BaseContentItem>);
      return Promise.resolve();
    },
    getMeta: <T extends BaseContentItem>(collection: string, slug: string) =>
      Promise.resolve(
        (metas.get(key(collection, slug)) as CachedItemMeta<T> | undefined) ??
          null,
      ),
    setMeta: <T extends BaseContentItem>(
      collection: string,
      slug: string,
      data: CachedItemMeta<T>,
    ) => {
      metas.set(
        key(collection, slug),
        data as unknown as CachedItemMeta<BaseContentItem>,
      );
      return Promise.resolve();
    },
    getContent: (collection, slug) =>
      Promise.resolve(contents.get(key(collection, slug)) ?? null),
    setContent: (collection, slug, data) => {
      contents.set(key(collection, slug), data);
      return Promise.resolve();
    },
    invalidate: (scope: InvalidateScope) => {
      if (scope === "all") {
        lists.clear();
        metas.clear();
        contents.clear();
        return Promise.resolve();
      }
      const kind = scope.kind ?? "all";
      const collection = scope.collection;
      if ("slug" in scope) {
        const k = key(collection, scope.slug);
        if (kind === "all" || kind === "meta") metas.delete(k);
        if (kind === "all" || kind === "content") contents.delete(k);
        return Promise.resolve();
      }
      const prefix = `${collection}:`;
      if (kind === "all" || kind === "meta") {
        lists.delete(collection);
        for (const k of [...metas.keys()])
          if (k.startsWith(prefix)) metas.delete(k);
      }
      if (kind === "all" || kind === "content") {
        for (const k of [...contents.keys()])
          if (k.startsWith(prefix)) contents.delete(k);
      }
      return Promise.resolve();
    },
  };

  const img: ImageCacheOps = {
    get: (hash) => Promise.resolve(images.get(hash) ?? null),
    set: (hash, data, contentType) => {
      images.set(hash, { data, contentType });
      return Promise.resolve();
    },
  };

  return {
    name: options.name ?? "fake-cache",
    handles: ["document", "image"] as const,
    doc,
    img,
    dump: () => ({ lists, metas, contents, images }),
  };
}

/** テスト用の最小 renderer。markdown をそのまま `<article>` で囲んで返す。 */
export const fakeRenderer: RendererFn = (markdown) =>
  Promise.resolve(`<article>${markdown}</article>`);

/** `createFixtureClient({ items })` 用の入力。 */
export interface CreateFixtureClientItemsOptions<
  T extends BaseContentItem = BaseContentItem,
> extends Omit<CreateClientOptions<CMSSources>, "sources"> {
  items: readonly T[];
  renderer?: RendererFn;
}

/** `createFixtureClient({ collections })` 用の入力。 */
export interface CreateFixtureClientCollectionsOptions<
  T extends BaseContentItem = BaseContentItem,
> extends Omit<CreateClientOptions<CMSSources>, "sources"> {
  collections: Record<string, FakeCollectionConfig<T>>;
  renderer?: RendererFn;
}

/** `createFixtureClient({ sources })` 用の入力。 */
export interface CreateFixtureClientSourcesOptions<
  S extends CMSSources = CMSSources,
> extends Omit<CreateClientOptions<S>, "sources"> {
  sources: S;
  renderer?: RendererFn;
}

/**
 * `createClient` のテスト用ラッパ。
 *
 * - `items` のみ指定すると単一 `posts` コレクションを作り、`cms.posts` が型付きで参照できる
 * - `collections` で複数コレクションを構成できる
 * - `sources` で本物の adapter (notionSource など) と混ぜることもできる
 * - `cache` 未指定なら `createFakeCache()` を 1 件挿す
 * - `renderer` 未指定なら `fakeRenderer` (markdown-html を動的 import させない)
 *
 * @example
 * const cms = createFixtureClient({
 *   items: [{ id: "1", slug: "hello", lastEditedTime: "2024-01-01", title: "Hi" }],
 * });
 * const posts = await cms.posts.list();
 */
export function createFixtureClient<T extends BaseContentItem>(
  options: CreateFixtureClientItemsOptions<T>,
): CMSClient<{ posts: CollectionDef<T> }>;
export function createFixtureClient<T extends BaseContentItem>(
  options: CreateFixtureClientCollectionsOptions<T>,
): CMSClient<CollectionsConfig>;
export function createFixtureClient<S extends CMSSources>(
  options: CreateFixtureClientSourcesOptions<S>,
): CMSClient<CollectionsConfig>;
// 実装シグネチャ。3 つの overload からのみ呼ばれる前提で、戻り値はキャストで揃える。
// biome-ignore lint/suspicious/noExplicitAny: 複数 overload を 1 つの実装で受けるための実装側 any。
export function createFixtureClient(options: any = {}): any {
  const sources =
    options.sources ??
    ({
      notion: createFakeNotionSource(
        options.collections
          ? { collections: options.collections }
          : { items: options.items ?? [] },
      ),
    } as unknown as CMSSources);

  const cache =
    options.cache && options.cache.length > 0
      ? options.cache
      : [createFakeCache()];

  return coreCreateClient({
    ...(options as CreateClientOptions<CMSSources>),
    sources,
    cache,
    renderer: options.renderer ?? fakeRenderer,
  });
}

// 型補完を効かせるため、testing パッケージを import するだけで `sources.notion?` が
// 候補に出るよう module augmentation する。本物の `@notion-headless-cms/notion-source`
// と同居しても shape (CMSAdapter) が同じなので衝突しない。
declare module "@notion-headless-cms/core" {
  interface CMSSources {
    notion?: CMSAdapter;
  }
}
