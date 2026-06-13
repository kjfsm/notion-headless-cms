import { isStale } from "./cache";
import { CMSError, isCMSError } from "./errors";
import { normalizePageId } from "./page-index";
import type { RenderContext } from "./rendering";
import { buildCachedItemContent, buildCachedItemMeta } from "./rendering";
import type { RetryConfig } from "./retry";
import { withRetry } from "./retry";
import type {
  AdjacencyOptions,
  BaseContentItem,
  CachedItemContent,
  CachedItemList,
  CachedItemMeta,
  CheckResult,
  CMSHooks,
  CollectionCacheOps,
  CollectionClient,
  DataSource,
  DocumentCacheOps,
  FindOptions,
  ItemWithContent,
  ListOptions,
  Logger,
  SortOption,
  WarmOptions,
  WarmResult,
  WhereClause,
} from "./types/index";

/**
 * コレクション別キャッシュキーを生成する (item: `{collection}:{slug}` / list: `{collection}`)。
 *
 * 各 cache adapter は内部で独自のキー戦略を持つが、ログ出力や差分再計算で
 * 同一表現が必要になるため core 側にも公開する。
 */
export function collectionKey(collection: string, slug?: string): string {
  return slug ? `${collection}:${slug}` : collection;
}

export interface CollectionContext<T extends BaseContentItem> {
  collection: string;
  source: DataSource<T>;
  docCache: DocumentCacheOps;
  docCacheName: string;
  render: RenderContext<T>;
  hooks: CMSHooks<T>;
  logger: Logger | undefined;
  ttlMs: number | undefined;
  publishedStatuses: string[];
  accessibleStatuses: string[];
  retryConfig: RetryConfig;
  maxConcurrent: number;
  waitUntil: ((p: Promise<unknown>) => void) | undefined;
  /**
   * slug として使うフィールド名。`source.properties[slugField].notion` を
   * Notion プロパティ名として `findByProp` を呼び出す。
   */
  slugField: string;
}

export class CollectionClientImpl<T extends BaseContentItem>
  implements CollectionClient<T>
{
  readonly cache: CollectionCacheOps<T>;

  constructor(private readonly ctx: CollectionContext<T>) {
    this.cache = {
      invalidate: () => this.invalidateImpl(),
      invalidateItem: (slug: string) => this.invalidateItemImpl(slug),
      warm: (opts?: WarmOptions) => this.warmImpl(opts),
      prime: (slug: string) => this.primeImpl(slug),
    };
  }

  /**
   * Notion ページ ID で該当アイテムを解決し、単件ウォーム + リストキャッシュを更新する。
   * このコレクションに属さない page id の場合は何もせず `null` を返す。
   * 一致した場合は温めた slug を返す（公式 webhook から `cms.warmByPageId` 経由で呼ばれる）。
   */
  async warmByPageId(pageId: string): Promise<string | null> {
    const item = await this.resolveByPageId(pageId);
    if (!item) return null;
    await this.primeItem(item);
    // 一覧の見出し・新規公開・並び順の変化を反映するためリストキャッシュも作り直す。
    await this.refreshList();
    return item.slug;
  }

  async find(
    slug: string,
    opts: FindOptions = {},
  ): Promise<ItemWithContent<T> | null> {
    if (opts.bypassCache) {
      this.ctx.hooks.onCacheMiss?.(slug);
      const item = await this.fetchRaw(slug);
      if (!item) return null;
      const meta = await this.persistMeta(slug, item);
      await this.invalidateContentEntry(slug);
      return this.attachLazyContent(meta);
    }

    const cachedMeta = await this.ctx.docCache.getMeta<T>(
      this.ctx.collection,
      slug,
    );
    if (cachedMeta) {
      // TTL 切れはブロッキングで再取得する (stale を返さない要件)
      if (
        this.ctx.ttlMs !== undefined &&
        isStale(cachedMeta.cachedAt, this.ctx.ttlMs)
      ) {
        this.ctx.logger?.debug?.("キャッシュ期限切れ（TTL）、フェッチ", {
          operation: "find",
          slug,
          collection: this.ctx.collection,
          cacheAdapter: this.ctx.docCacheName,
        });
        this.ctx.hooks.onCacheMiss?.(slug);
        const item = await this.fetchRaw(slug);
        if (!item) return null;
        const meta = await this.persistMeta(slug, item);
        await this.invalidateContentEntry(slug);
        return this.attachLazyContent(meta);
      }
      const bg = this.checkAndUpdateItemBg(slug, cachedMeta);
      if (this.ctx.waitUntil) this.ctx.waitUntil(bg);
      this.ctx.logger?.debug?.("キャッシュヒット", {
        operation: "find",
        slug,
        collection: this.ctx.collection,
        cacheAdapter: this.ctx.docCacheName,
        cachedAt: cachedMeta.cachedAt,
      });
      this.ctx.hooks.onCacheHit?.(slug, cachedMeta);
      return this.attachLazyContent(cachedMeta);
    }

    this.ctx.logger?.debug?.("キャッシュミス、フェッチ", {
      operation: "find",
      slug,
      collection: this.ctx.collection,
      cacheAdapter: this.ctx.docCacheName,
    });
    this.ctx.hooks.onCacheMiss?.(slug);
    const item = await this.fetchRaw(slug);
    if (!item) return null;
    // 保存だけはバックグラウンド可: ユーザー向けレスポンスを早めに返す
    const meta = await this.persistMeta(slug, item, { background: true });
    return this.attachLazyContent(meta);
  }

  async list(opts?: ListOptions<T>): Promise<T[]> {
    const allItems = await this.fetchList();
    return applyListOptions(allItems, opts);
  }

  async params(): Promise<string[]> {
    const items = await this.fetchList();
    return items.map((item) => item.slug);
  }

  async peekVersion(
    slug: string,
  ): Promise<{ notionUpdatedAt: string; cachedAt: number } | null> {
    const meta = await this.ctx.docCache.getMeta<T>(this.ctx.collection, slug);
    if (!meta) return null;
    return { notionUpdatedAt: meta.notionUpdatedAt, cachedAt: meta.cachedAt };
  }

  async check(
    slug: string,
    currentVersion: string,
  ): Promise<CheckResult<T> | null> {
    const raw = await this.fetchRaw(slug);
    if (!raw) return null;
    if (raw.lastEditedTime === currentVersion) return { stale: false };
    const meta = await this.persistMeta(slug, raw);
    await this.invalidateContentEntry(slug);
    return { stale: true, item: this.attachLazyContent(meta) };
  }

  async adjacent(
    slug: string,
    opts?: AdjacencyOptions<T>,
  ): Promise<{ prev: T | null; next: T | null }> {
    const items = applyListOptions(await this.fetchList(), {
      sort: opts?.sort,
    });
    const index = items.findIndex((it) => it.slug === slug);
    if (index === -1) return { prev: null, next: null };
    return {
      prev: index > 0 ? (items[index - 1] ?? null) : null,
      next: index < items.length - 1 ? (items[index + 1] ?? null) : null,
    };
  }

  private async invalidateImpl(): Promise<void> {
    this.ctx.logger?.debug?.("コレクション全体のキャッシュを無効化", {
      operation: "cache.invalidate",
      collection: this.ctx.collection,
      cacheAdapter: this.ctx.docCacheName,
    });
    await this.ctx.docCache.invalidate({ collection: this.ctx.collection });
  }

  private async invalidateItemImpl(slug: string): Promise<void> {
    this.ctx.logger?.debug?.("アイテムキャッシュを無効化", {
      operation: "cache.invalidateItem",
      collection: this.ctx.collection,
      cacheAdapter: this.ctx.docCacheName,
      slug,
    });
    await this.ctx.docCache.invalidate({
      collection: this.ctx.collection,
      slug,
    });
  }

  private async warmImpl(opts?: WarmOptions): Promise<WarmResult> {
    const items = await this.fetchListRaw();
    const concurrency = opts?.concurrency ?? this.ctx.maxConcurrent;
    let ok = 0;
    const failed: Array<{ slug: string; error: unknown }> = [];

    for (let i = 0; i < items.length; i += concurrency) {
      const chunk = items.slice(i, i + concurrency);
      await Promise.all(
        chunk.map(async (item) => {
          try {
            await this.primeItem(item);
            ok++;
          } catch (err) {
            failed.push({ slug: item.slug, error: err });
            this.ctx.logger?.warn?.("warm: アイテムの事前レンダリングに失敗", {
              slug: item.slug,
              pageId: item.id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }),
      );
      opts?.onProgress?.(Math.min(i + concurrency, items.length), items.length);
    }

    await this.ctx.docCache.setList(this.ctx.collection, {
      items,
      cachedAt: Date.now(),
    });
    return { ok, failed };
  }

  private async primeImpl(slug: string): Promise<void> {
    const item = await this.fetchRaw(slug);
    if (!item) return;
    await this.primeItem(item);
  }

  /** 取得済みアイテムからメタ・本文キャッシュを作り直す（warm / prime / warmByPageId 共通）。 */
  private async primeItem(item: T): Promise<void> {
    await this.persistMeta(item.slug, item);
    const content = await buildCachedItemContent(item, this.ctx.render);
    await this.ctx.docCache.setContent(this.ctx.collection, item.slug, content);
  }

  /** リストキャッシュを最新の取得結果で作り直す。 */
  private async refreshList(): Promise<void> {
    const items = await this.fetchListRaw();
    await this.ctx.docCache.setList(this.ctx.collection, {
      items,
      cachedAt: Date.now(),
    });
  }

  /** Notion page id からアクセス可能なアイテムを解決する。`findById` 優先、無ければ list を走査。 */
  private async resolveByPageId(pageId: string): Promise<T | null> {
    const target = normalizePageId(pageId);
    const findById = this.ctx.source.findById?.bind(this.ctx.source);
    let item: T | null;
    if (findById) {
      item = await withRetry(() => findById(pageId), {
        ...this.ctx.retryConfig,
        onRetry: (attempt, status, delayMs) => {
          this.ctx.logger?.warn?.("findById() リトライ中", {
            attempt,
            status,
            pageId,
            backoffMs: delayMs,
          });
        },
      });
    } else {
      const all = await this.fetchListRaw();
      item = all.find((i) => normalizePageId(i.id) === target) ?? null;
    }

    if (!item) return null;
    if (item.isArchived || item.isInTrash) return null;
    if (
      this.ctx.accessibleStatuses.length > 0 &&
      (!item.status || !this.ctx.accessibleStatuses.includes(item.status))
    ) {
      return null;
    }
    return item;
  }

  private async persistMeta(
    slug: string,
    item: T,
    opts: { background?: boolean } = {},
  ): Promise<CachedItemMeta<T>> {
    let meta = buildCachedItemMeta(item, this.ctx.source);
    if (this.ctx.hooks.beforeCacheMeta) {
      meta = await this.ctx.hooks.beforeCacheMeta(meta);
    }
    const save = this.ctx.docCache.setMeta(this.ctx.collection, slug, meta);
    if (opts.background && this.ctx.waitUntil) {
      this.ctx.waitUntil(save);
    } else {
      await save;
    }
    return meta;
  }

  private async invalidateContentEntry(slug: string): Promise<void> {
    await this.ctx.docCache.invalidate({
      collection: this.ctx.collection,
      slug,
      kind: "content",
    });
  }

  /** 本文キャッシュ。メタとの整合 (`notionUpdatedAt`) が崩れていれば再生成して書き戻す。 */
  private async loadOrBuildContent(
    slug: string,
    item: T,
  ): Promise<CachedItemContent> {
    const expected = this.ctx.source.getLastModified(item);
    const cached = await this.ctx.docCache.getContent(
      this.ctx.collection,
      slug,
    );
    if (cached && cached.notionUpdatedAt === expected) {
      return cached;
    }

    const fresh = await buildCachedItemContent(item, this.ctx.render);
    await this.ctx.docCache.setContent(this.ctx.collection, slug, fresh);
    this.ctx.hooks.onContentRevalidated?.(slug, fresh);
    return fresh;
  }

  /** メタ既知の状態で本文だけ再生成する。エラーは onSwrError フックに通知して握り潰す。 */
  private async rebuildContentBg(slug: string, item: T): Promise<void> {
    try {
      const fresh = await buildCachedItemContent(item, this.ctx.render);
      await this.ctx.docCache.setContent(this.ctx.collection, slug, fresh);
      this.ctx.hooks.onContentRevalidated?.(slug, fresh);
    } catch (err) {
      const cmsErr = isCMSError(err)
        ? err
        : new CMSError({
            code: "swr/content_rebuild_failed",
            message: "SWR background content rebuild failed.",
            cause: err,
            context: {
              operation: "swr.rebuildContentBg",
              collection: this.ctx.collection,
              slug,
            },
          });
      this.ctx.hooks.onSwrError?.(cmsErr, { phase: "item-content", slug });
      this.ctx.logger?.warn?.("本文のバックグラウンド再生成に失敗", {
        slug,
        collection: this.ctx.collection,
        code: cmsErr.code,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private attachLazyContent(meta: CachedItemMeta<T>): ItemWithContent<T> {
    const slug = meta.item.slug;
    const item = meta.item;
    // html() / markdown() / blocks() を同じアイテムから複数回呼んでも I/O は 1 回に集約する
    let payloadPromise: Promise<CachedItemContent> | undefined;
    const loadPayload = (): Promise<CachedItemContent> => {
      if (!payloadPromise) {
        payloadPromise = this.loadOrBuildContent(slug, item);
      }
      return payloadPromise;
    };

    return Object.assign(Object.create(null) as object, item, {
      html: async () => (await loadPayload()).html,
      markdown: async () => (await loadPayload()).markdown,
      blocks: async () => (await loadPayload()).blocks,
      notionBlocks: async () => {
        const notionBlocks = (await loadPayload()).notionBlocks;
        // markdown 戦略やフェッチャ未設定だと常に undefined になり、
        // React レンダリング側で原因が分からない無言失敗になるため一度だけ案内する。
        if (notionBlocks === undefined) this.warnMissingNotionBlocks();
        return notionBlocks;
      },
    }) as ItemWithContent<T>;
  }

  private notionBlocksWarned = false;

  private warnMissingNotionBlocks(): void {
    if (this.notionBlocksWarned) return;
    this.notionBlocksWarned = true;
    this.ctx.logger?.warn?.(
      "notionBlocks() が undefined を返しました。BlockObjectResponse ツリーは blocks 戦略でのみ得られます (notionSource の fetch 未指定の既定でも有効)。markdownFetcher を使用中の場合は markdown→React の Renderer を使うか、blocksFetcher() に切り替えてください。",
      { collection: this.ctx.collection, operation: "notionBlocks" },
    );
  }

  private async fetchList(): Promise<T[]> {
    const cached = await this.ctx.docCache.getList<T>(this.ctx.collection);
    if (cached) {
      if (
        this.ctx.ttlMs !== undefined &&
        isStale(cached.cachedAt, this.ctx.ttlMs)
      ) {
        this.ctx.logger?.debug?.("リストキャッシュ期限切れ（TTL）、フェッチ", {
          operation: "list",
          collection: this.ctx.collection,
          cacheAdapter: this.ctx.docCacheName,
        });
        this.ctx.hooks.onListCacheMiss?.();
        const items = await this.fetchListRaw();
        await this.ctx.docCache.setList(this.ctx.collection, {
          items,
          cachedAt: Date.now(),
        });
        return items;
      }
      const bg = this.checkAndUpdateListBg(cached);
      if (this.ctx.waitUntil) this.ctx.waitUntil(bg);
      this.ctx.logger?.debug?.("リストキャッシュヒット", {
        operation: "list",
        collection: this.ctx.collection,
        cacheAdapter: this.ctx.docCacheName,
      });
      this.ctx.hooks.onListCacheHit?.(cached);
      return cached.items;
    }

    this.ctx.logger?.debug?.("リストキャッシュミス、フェッチ", {
      operation: "list",
      collection: this.ctx.collection,
      cacheAdapter: this.ctx.docCacheName,
    });
    this.ctx.hooks.onListCacheMiss?.();
    const items = await this.fetchListRaw();
    const cachedAt = Date.now();
    const save = this.ctx.docCache.setList(this.ctx.collection, {
      items,
      cachedAt,
    });
    if (this.ctx.waitUntil) {
      this.ctx.waitUntil(save);
    } else {
      await save;
    }
    return items;
  }

  private async checkAndUpdateItemBg(
    slug: string,
    cached: CachedItemMeta<T>,
  ): Promise<void> {
    try {
      const item = await this.fetchRaw(slug);
      if (!item) return;
      const lm = this.ctx.source.getLastModified(item);
      if (lm !== cached.notionUpdatedAt) {
        const meta = await this.persistMeta(slug, item);
        await this.invalidateContentEntry(slug);
        this.ctx.logger?.debug?.("SWR: 差分を検出、メタを差し替え", {
          operation: "find:bg",
          slug,
          collection: this.ctx.collection,
          notionUpdatedAt: cached.notionUpdatedAt,
        });
        this.ctx.hooks.onCacheRevalidated?.(slug, meta);
        await this.rebuildContentBg(slug, item);
      } else {
        await this.ctx.docCache.setMeta(this.ctx.collection, slug, {
          ...cached,
          cachedAt: Date.now(),
        });
        this.ctx.logger?.debug?.("SWR: 差分なし、cachedAt を更新", {
          operation: "find:bg",
          slug,
          collection: this.ctx.collection,
        });
      }
    } catch (err) {
      const cmsErr = isCMSError(err)
        ? err
        : new CMSError({
            code: "swr/item_check_failed",
            message: "SWR background item check failed.",
            cause: err,
            context: {
              operation: "swr.checkAndUpdateItemBg",
              collection: this.ctx.collection,
              slug,
            },
          });
      this.ctx.hooks.onSwrError?.(cmsErr, { phase: "item-meta", slug });
      this.ctx.logger?.warn?.(
        "SWR: アイテムのバックグラウンド差分チェックに失敗",
        {
          slug,
          collection: this.ctx.collection,
          code: cmsErr.code,
          error: err instanceof Error ? err.message : String(err),
        },
      );
    }
  }

  private async checkAndUpdateListBg(cached: CachedItemList<T>): Promise<void> {
    try {
      const items = await this.fetchListRaw();
      if (
        this.ctx.source.getListVersion(items) !==
        this.ctx.source.getListVersion(cached.items)
      ) {
        const listEntry = { items, cachedAt: Date.now() };
        await this.ctx.docCache.setList(this.ctx.collection, listEntry);
        this.ctx.logger?.debug?.(
          "SWR: リスト差分を検出、キャッシュを差し替え",
          {
            operation: "list:bg",
            collection: this.ctx.collection,
          },
        );
        this.ctx.hooks.onListCacheRevalidated?.(listEntry);
      } else if (this.ctx.ttlMs !== undefined) {
        await this.ctx.docCache.setList(this.ctx.collection, {
          ...cached,
          cachedAt: Date.now(),
        });
        this.ctx.logger?.debug?.("SWR: リスト差分なし、TTL をリセット", {
          operation: "list:bg",
          collection: this.ctx.collection,
        });
      }
    } catch (err) {
      const cmsErr = isCMSError(err)
        ? err
        : new CMSError({
            code: "swr/list_check_failed",
            message: "SWR background list check failed.",
            cause: err,
            context: {
              operation: "swr.checkAndUpdateListBg",
              collection: this.ctx.collection,
            },
          });
      this.ctx.hooks.onSwrError?.(cmsErr, { phase: "list" });
      this.ctx.logger?.warn?.(
        "SWR: リストのバックグラウンド差分チェックに失敗",
        {
          collection: this.ctx.collection,
          code: cmsErr.code,
          error: err instanceof Error ? err.message : String(err),
        },
      );
    }
  }

  private async fetchListRaw(): Promise<T[]> {
    const items = await withRetry(
      () =>
        this.ctx.source.list({
          publishedStatuses:
            this.ctx.publishedStatuses.length > 0
              ? this.ctx.publishedStatuses
              : undefined,
        }),
      {
        ...this.ctx.retryConfig,
        onRetry: (attempt, status, delayMs) => {
          this.ctx.logger?.warn?.("list() リトライ中", {
            attempt,
            status,
            backoffMs: delayMs,
          });
        },
      },
    );
    return items.filter((item) => {
      if (item.isArchived || item.isInTrash) return false;
      if (
        this.ctx.accessibleStatuses.length > 0 &&
        (!item.status || !this.ctx.accessibleStatuses.includes(item.status))
      )
        return false;
      return true;
    });
  }

  private async fetchRaw(slug: string): Promise<T | null> {
    const retryOpts = {
      ...this.ctx.retryConfig,
      onRetry: (attempt: number, status: number, delayMs?: number) => {
        this.ctx.logger?.warn?.("find() リトライ中", {
          attempt,
          status,
          slug,
          backoffMs: delayMs,
        });
      },
    };

    // PropertyMap が解決できる場合は単一プロパティ filter で 1 ページだけ取得する (高速)
    const notionPropName =
      this.ctx.source.properties?.[this.ctx.slugField]?.notion;

    let item: T | null;
    const findByProp = this.ctx.source.findByProp?.bind(this.ctx.source);
    if (notionPropName && findByProp) {
      item = await withRetry(() => findByProp(notionPropName, slug), retryOpts);
    } else {
      const all = await withRetry(() => this.ctx.source.list(), retryOpts);
      item = all.find((i) => i.slug === slug) ?? null;
    }

    if (!item) return null;
    if (item.isArchived || item.isInTrash) return null;
    if (
      this.ctx.accessibleStatuses.length > 0 &&
      (!item.status || !this.ctx.accessibleStatuses.includes(item.status))
    ) {
      return null;
    }
    return item;
  }
}

function matchesWhere<T extends BaseContentItem>(
  item: T,
  where: WhereClause<T>,
): boolean {
  for (const key of Object.keys(where) as (keyof T & string)[]) {
    const expected = where[key];
    const actual = item[key];
    if (Array.isArray(expected)) {
      if (!(expected as readonly unknown[]).includes(actual)) return false;
    } else {
      if (actual !== expected) return false;
    }
  }
  return true;
}

function applyListOptions<T extends BaseContentItem>(
  items: T[],
  opts?: ListOptions<T>,
): T[] {
  if (!opts) return sortByPublishedAtDesc(items);
  let result = items;

  if (opts.statuses) {
    const allow = new Set(
      Array.isArray(opts.statuses) ? opts.statuses : [opts.statuses],
    );
    result = result.filter((it) => it.status != null && allow.has(it.status));
  }

  if (opts.tag) {
    const tag = opts.tag;
    result = result.filter((it) => {
      const tags = (it as { tags?: string[] }).tags;
      return Array.isArray(tags) && tags.includes(tag);
    });
  }

  if (opts.where) {
    const where = opts.where;
    result = result.filter((it) => matchesWhere(it, where));
  }

  if (opts.filter) {
    result = result.filter(opts.filter);
  }

  if (opts.sort) {
    result = [...result].sort(makeComparator(opts.sort));
  } else {
    result = sortByPublishedAtDesc(result);
  }

  const skip = opts.skip ?? 0;
  const limit = opts.limit;
  if (skip > 0 || limit !== undefined) {
    result = result.slice(skip, limit !== undefined ? skip + limit : undefined);
  }

  return result;
}

/** publishedAt 降順 (未設定なら lastEditedTime 降順) でソートする。 */
function sortByPublishedAtDesc<T extends BaseContentItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const av = a.publishedAt ?? a.lastEditedTime;
    const bv = b.publishedAt ?? b.lastEditedTime;
    if (av === bv) return 0;
    return av > bv ? -1 : 1;
  });
}

function makeComparator<T extends BaseContentItem>(
  sort: SortOption<T>,
): (a: T, b: T) => number {
  if (sort.compare) return sort.compare;
  const by = sort.by as keyof T;
  const dir = sort.dir === "asc" ? 1 : -1;
  return (a, b) => {
    const av = a[by];
    const bv = b[by];
    if (av === bv) return 0;
    if (av === undefined || av === null) return 1;
    if (bv === undefined || bv === null) return -1;
    if (typeof av === "string" && typeof bv === "string") {
      return av > bv ? dir : -dir;
    }
    if (typeof av === "number" && typeof bv === "number") {
      return av > bv ? dir : -dir;
    }
    throw new CMSError({
      code: "core/sort_unsupported_type",
      message: `"${String(by)}" フィールドの型 "${typeof av}" はソート非対応です。compare 関数を指定してください。`,
      context: {
        operation: "makeComparator",
        field: String(by),
        type: typeof av,
      },
    });
  };
}
