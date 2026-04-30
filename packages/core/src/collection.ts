import { isStale } from "./cache";
import { CMSError, isCMSError } from "./errors";
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
 * コレクション別キャッシュキーを生成する。
 * item: `{collection}:{slug}` / list: `{collection}`
 *
 * (Cache adapter 内部のキー戦略はアダプタごとに異なるが、
 * 表示や再計算用に core 側でも公開ヘルパーを提供する)
 */
export function collectionKey(collection: string, slug?: string): string {
  return slug ? `${collection}:${slug}` : collection;
}

/** 単一コレクションの DataSource + SWR キャッシュ依存を束ねたコンテキスト。 */
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
   * slug として使うフィールド名 (CLI 生成の `CollectionDef.slugField`)。
   * `source.properties[slugField].notion` を Notion プロパティ名として
   * `findByProp` を呼び出す。
   */
  slugField: string;
}

/** CollectionClient の実装。ユーザーは `createCMS` 経由でインスタンスを受け取る。 */
export class CollectionClientImpl<T extends BaseContentItem>
  implements CollectionClient<T>
{
  readonly cache: CollectionCacheOps<T>;

  constructor(private readonly ctx: CollectionContext<T>) {
    this.cache = {
      invalidate: () => this.invalidateImpl(),
      invalidateItem: (slug: string) => this.invalidateItemImpl(slug),
      warm: (opts?: WarmOptions) => this.warmImpl(opts),
    };
  }

  // ── 基本取得 ──────────────────────────────────────────────────────────

  async find(
    slug: string,
    opts: FindOptions = {},
  ): Promise<ItemWithContent<T> | null> {
    // bypassCache: 強制ブロッキング取得
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
      if (
        this.ctx.ttlMs !== undefined &&
        isStale(cachedMeta.cachedAt, this.ctx.ttlMs)
      ) {
        // TTL 切れ: ブロッキング再取得
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
      // SWR: キャッシュ即時返却 + バックグラウンド差分チェック
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

    // メタ未キャッシュ: 同期フェッチ (保存はバックグラウンド可)
    this.ctx.logger?.debug?.("キャッシュミス、フェッチ", {
      operation: "find",
      slug,
      collection: this.ctx.collection,
      cacheAdapter: this.ctx.docCacheName,
    });
    this.ctx.hooks.onCacheMiss?.(slug);
    const item = await this.fetchRaw(slug);
    if (!item) return null;
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

  // ── キャッシュ操作 ────────────────────────────────────────────────────

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
            await this.persistMeta(item.slug, item);
            const content = await buildCachedItemContent(item, this.ctx.render);
            await this.ctx.docCache.setContent(
              this.ctx.collection,
              item.slug,
              content,
            );
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

  // ── 内部 ──────────────────────────────────────────────────────────────

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

  /**
   * 本文キャッシュをロードする。キャッシュが無いか、メタとの整合性が取れない場合は
   * 再生成して書き戻す。
   */
  private async loadOrBuildContent(
    slug: string,
    item: T,
  ): Promise<CachedItemContent> {
    const expected = this.ctx.source.getLastModified(item);
    const cached = await this.ctx.docCache.getContent(
      this.ctx.collection,
      slug,
    );
    if (cached && cached.notionUpdatedAt === expected) return cached;

    const fresh = await buildCachedItemContent(item, this.ctx.render);
    await this.ctx.docCache.setContent(this.ctx.collection, slug, fresh);
    this.ctx.hooks.onContentRevalidated?.(slug, fresh);
    return fresh;
  }

  /** メタ既知の状態で本文だけバックグラウンド再生成する。エラーは onSwrError フックに通知する。 */
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
    // 同一インスタンス内で本文ロードを集約する (複数呼び出しでも 1 回の I/O)
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
    }) as ItemWithContent<T>;
  }

  private async fetchList(): Promise<T[]> {
    const cached = await this.ctx.docCache.getList<T>(this.ctx.collection);
    if (cached) {
      if (
        this.ctx.ttlMs !== undefined &&
        isStale(cached.cachedAt, this.ctx.ttlMs)
      ) {
        // TTL 切れ: ブロッキング再取得
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
      // SWR: 即時返却 + バックグラウンド差分チェック
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

    // 未キャッシュ: 同期フェッチ
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
      } else if (this.ctx.ttlMs !== undefined) {
        // 変更なし + TTL あり: cachedAt をリセットして次回の期限切れを先送りする
        await this.ctx.docCache.setMeta(this.ctx.collection, slug, {
          ...cached,
          cachedAt: Date.now(),
        });
        this.ctx.logger?.debug?.("SWR: 差分なし、TTL をリセット", {
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
        onRetry: (attempt, status) => {
          this.ctx.logger?.warn?.("list() リトライ中", { attempt, status });
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
      onRetry: (attempt: number, status: number) => {
        this.ctx.logger?.warn?.("find() リトライ中", {
          attempt,
          status,
          slug,
        });
      },
    };

    // slugField から Notion プロパティ名を解決して効率的なフィルタクエリを実行する。
    const notionPropName =
      this.ctx.source.properties?.[this.ctx.slugField]?.notion;

    let item: T | null;
    const findByProp = this.ctx.source.findByProp?.bind(this.ctx.source);
    if (notionPropName && findByProp) {
      item = await withRetry(() => findByProp(notionPropName, slug), retryOpts);
    } else {
      // フォールバック: list して線形探索
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

/** publishedAt 降順、未設定の場合は lastEditedTime 降順でソートする。 */
function sortByPublishedAtDesc<T extends BaseContentItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    // lastEditedTime は必須なので av/bv は常に truthy
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
