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
  DataCollectionCacheOps,
  DataCollectionClient,
  DataSource,
  DocumentCacheOps,
  FindOptions,
  ItemWithContent,
  ListOptions,
  Logger,
  RealtimeAdapter,
  RealtimeEvent,
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

/**
 * アイテムの内部 identity（キャッシュキー・ログ用）を返す。
 * ページコレクションは slug、URL を持たない要素コレクションは id でキー管理する。
 * slug が空文字のときも id にフォールバックし、`""` キーでの衝突を防ぐ（`??` ではなく `||`）。
 */
export function itemKey(item: BaseContentItem): string {
  return item.slug || item.id;
}

export interface CollectionContext<T extends BaseContentItem> {
  collection: string;
  source: DataSource<T>;
  docCache: DocumentCacheOps;
  docCacheName: string;
  render: RenderContext<T>;
  hooks: CMSHooks<T>;
  logger: Logger | undefined;
  /**
   * ブロック閾値（ms）。`cachedAt`（最終確認時刻）からこの時間を超えたら
   * 開く時にブロッキングで再取得する。`undefined` ならブロックしない（無期限即表示）。
   * webhook 管理時は `undefined` に解決される。
   */
  blockMs: number | undefined;
  /** 再チェックの最小間隔（coalescing, ms）。この時間内は Notion を再照会しない。 */
  recheckWindowMs: number;
  publishedStatuses: string[];
  accessibleStatuses: string[];
  retryConfig: RetryConfig;
  maxConcurrent: number;
  waitUntil: ((p: Promise<unknown>) => void) | undefined;
  realtime: RealtimeAdapter | undefined;
  /**
   * slug として使うフィールド名。`source.properties[slugField].notion` を
   * Notion プロパティ名として `findByProp` を呼び出す。
   * 要素コレクション（`kind: "data"`）では未指定。
   */
  slugField?: string;
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

  /** データソースの表示名を取得する。DataSource が未対応なら undefined。 */
  getDbName(): Promise<string | undefined> {
    return this.ctx.source.getDbName?.() ?? Promise.resolve(undefined);
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
    await this.publishRealtime({
      collection: this.ctx.collection,
      slug: itemKey(item),
      version: this.ctx.source.getLastModified(item),
    });
    return itemKey(item);
  }

  /** Notion page id でアイテムを解決する（本文を伴わない素の取得）。要素コレクションの `get(id)` で使う。 */
  async getById(id: string): Promise<T | null> {
    return this.resolveByPageId(id);
  }

  /** リストキャッシュを最新の取得結果で作り直す（要素コレクションの webhook 再検証で使う）。 */
  async revalidateList(): Promise<void> {
    await this.refreshList();
  }

  async find(
    slug: string,
    opts: FindOptions = {},
  ): Promise<ItemWithContent<T> | null> {
    return this.runForeground("find", slug, () => this.findImpl(slug, opts));
  }

  private async findImpl(
    slug: string,
    opts: FindOptions = {},
  ): Promise<ItemWithContent<T> | null> {
    // 明示リロード（force）/ bypassCache はブロッキングで最新を返し、本文 cache を破棄する。
    if (opts.bypassCache || opts.force) {
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
      // 最終確認から blockMs を超えたら stale を返さずブロッキングで再取得する。
      // webhook 管理時は blockMs=undefined（決してブロックしない）。
      if (
        this.ctx.blockMs !== undefined &&
        isStale(cachedMeta.cachedAt, this.ctx.blockMs)
      ) {
        this.ctx.logger?.debug?.("キャッシュ期限切れ（block 閾値）、フェッチ", {
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
      // 新しい → 即キャッシュ返却。recheck ウィンドウを超えていれば裏で Notion と突合する
      // （ウィンドウ内は照会しない＝複数端末・連続アクセスを集約する）。
      if (Date.now() - cachedMeta.cachedAt >= this.ctx.recheckWindowMs) {
        const bg = this.revalidateItemBg(slug);
        if (this.ctx.waitUntil) this.ctx.waitUntil(bg);
      }
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
    // slug を持つアイテムのみページ化対象（空文字・未設定は除外）。
    return items
      .map((item) => item.slug)
      .filter((slug): slug is string => Boolean(slug));
  }

  async check(
    slug: string,
    currentVersion: string,
  ): Promise<CheckResult<T> | null> {
    // 公開 API は「必ず実照会」を意図するため force で coalescing を回避する。
    const r = await this.runForeground("check", slug, () =>
      this.refreshFromNotion(slug, { force: true }),
    );
    if (!r) return null;
    if (r.version === currentVersion) return { stale: false };
    return { stale: true, item: this.attachLazyContent(r.meta) };
  }

  /**
   * クライアント鮮度エンドポイント（`POST /check`）用。coalescing 付きで Notion と突合し、
   * クライアントが提示した `currentVersion` に対する stale 判定と現在の version を返す。
   * アイテムが存在しなければ `null`。
   */
  async checkVersion(
    slug: string,
    currentVersion: string,
    opts: { force?: boolean } = {},
  ): Promise<{ stale: boolean; version: string } | null> {
    const r = await this.runForeground("check", slug, () =>
      this.refreshFromNotion(slug, { force: opts.force }),
    );
    if (!r) return null;
    return { stale: r.version !== currentVersion, version: r.version };
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
            failed.push({ slug: itemKey(item), error: err });
            this.ctx.logger?.warn?.("warm: アイテムの事前レンダリングに失敗", {
              slug: itemKey(item),
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
    const key = itemKey(item);
    await this.persistMeta(key, item);
    const content = await buildCachedItemContent(item, this.ctx.render);
    await this.ctx.docCache.setContent(this.ctx.collection, key, content);
  }

  /**
   * リストキャッシュを最新の取得結果で作り直し、list チャンネル（slug なし）へ通知する。
   * webhook 由来の `warmByPageId` / `revalidateList` から呼ばれ、一覧購読クライアントへ
   * 新規公開・並び順変化を push する。差分判定は呼び出し文脈（webhook=常に最新化）に委ねる。
   */
  private async refreshList(): Promise<T[]> {
    const items = await this.fetchListRaw();
    await this.ctx.docCache.setList(this.ctx.collection, {
      items,
      cachedAt: Date.now(),
    });
    await this.publishRealtime({
      collection: this.ctx.collection,
      version: this.ctx.source.getListVersion(items),
    });
    return items;
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
    const item = meta.item;
    const slug = itemKey(item);
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

  // foreground（ユーザー応答に直結する）取得のハード失敗だけを error として記録する。
  // SWR バックグラウンド更新は fail-soft で別途 warn 済みのため、ここでは扱わない（二重出力を避ける）。
  private async runForeground<R>(
    operation: string,
    slug: string | undefined,
    fn: () => Promise<R>,
  ): Promise<R> {
    try {
      return await fn();
    } catch (err) {
      this.ctx.logger?.error?.("foreground 取得に失敗", {
        operation,
        collection: this.ctx.collection,
        ...(slug ? { slug } : {}),
        ...(isCMSError(err) ? { code: err.code } : {}),
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  private async fetchList(): Promise<T[]> {
    return this.runForeground("list", undefined, () => this.fetchListImpl());
  }

  private async fetchListImpl(): Promise<T[]> {
    const cached = await this.ctx.docCache.getList<T>(this.ctx.collection);
    if (cached) {
      if (
        this.ctx.blockMs !== undefined &&
        isStale(cached.cachedAt, this.ctx.blockMs)
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

  /** 更新通知を fail-soft で発行する。通知失敗が配信・キャッシュ更新を壊さないよう握り潰す。 */
  private async publishRealtime(event: RealtimeEvent): Promise<void> {
    const adapter = this.ctx.realtime;
    if (!adapter) return;
    try {
      await adapter.publish(event);
    } catch (err) {
      this.ctx.logger?.warn?.("realtime: 更新通知の発行に失敗", {
        operation: "realtime.publish",
        collection: event.collection,
        slug: event.slug,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * coalescing 付きで Notion と突合する更新検知の中核。
   * - recheck ウィンドウ内（かつ `force` でない）なら Notion を照会せず既知 version を返す。
   * - 差分あり → メタ更新 + 本文 cache 無効化 +（`eagerRebuild` 時）本文再生成 + realtime 通知。
   * - 差分なし → `cachedAt` を更新してウィンドウを再起算。
   * アイテムが存在しなければ `null`。エラーは握り潰さず呼び出し側へ伝播する。
   */
  private async refreshFromNotion(
    slug: string,
    opts: { force?: boolean; eagerRebuild?: boolean } = {},
  ): Promise<{
    changed: boolean;
    version: string;
    meta: CachedItemMeta<T>;
  } | null> {
    const cached = await this.ctx.docCache.getMeta<T>(
      this.ctx.collection,
      slug,
    );
    if (
      !opts.force &&
      cached &&
      Date.now() - cached.cachedAt < this.ctx.recheckWindowMs
    ) {
      return { changed: false, version: cached.notionUpdatedAt, meta: cached };
    }
    const item = await this.fetchRaw(slug);
    if (!item) return null;
    const version = this.ctx.source.getLastModified(item);
    if (!cached || version !== cached.notionUpdatedAt) {
      const meta = await this.persistMeta(slug, item);
      await this.invalidateContentEntry(slug);
      this.ctx.logger?.debug?.("更新検知: 差分を検出、メタを差し替え", {
        operation: "refreshFromNotion",
        slug,
        collection: this.ctx.collection,
        notionUpdatedAt: cached?.notionUpdatedAt,
      });
      this.ctx.hooks.onCacheRevalidated?.(slug, meta);
      if (opts.eagerRebuild) await this.rebuildContentBg(slug, item);
      // キャッシュ書き込み完了後に通知する（先に通知すると client が古い loader データを掴む）。
      await this.publishRealtime({
        collection: this.ctx.collection,
        slug,
        version,
      });
      return { changed: true, version, meta };
    }
    const bumped: CachedItemMeta<T> = { ...cached, cachedAt: Date.now() };
    await this.ctx.docCache.setMeta(this.ctx.collection, slug, bumped);
    this.ctx.logger?.debug?.("更新検知: 差分なし、cachedAt を更新", {
      operation: "refreshFromNotion",
      slug,
      collection: this.ctx.collection,
    });
    return { changed: false, version, meta: bumped };
  }

  /** find() のバックグラウンド更新検知。fail-soft で `refreshFromNotion`（本文も再生成）を回す。 */
  private async revalidateItemBg(slug: string): Promise<void> {
    try {
      await this.refreshFromNotion(slug, { eagerRebuild: true });
    } catch (err) {
      const cmsErr = isCMSError(err)
        ? err
        : new CMSError({
            code: "swr/item_check_failed",
            message: "SWR background item check failed.",
            cause: err,
            context: {
              operation: "swr.revalidateItemBg",
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
        await this.publishRealtime({
          collection: this.ctx.collection,
          version: this.ctx.source.getListVersion(items),
        });
      } else if (this.ctx.blockMs !== undefined) {
        await this.ctx.docCache.setList(this.ctx.collection, {
          ...cached,
          cachedAt: Date.now(),
        });
        this.ctx.logger?.debug?.("SWR: リスト差分なし、確認時刻をリセット", {
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
    const notionPropName = this.ctx.slugField
      ? this.ctx.source.properties?.[this.ctx.slugField]?.notion
      : undefined;

    let item: T | null;
    const findByProp = this.ctx.source.findByProp?.bind(this.ctx.source);
    if (notionPropName && findByProp) {
      item = await withRetry(() => findByProp(notionPropName, slug), retryOpts);
    } else {
      const all = await withRetry(() => this.ctx.source.list(), retryOpts);
      item = all.find((i) => itemKey(i) === slug) ?? null;
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

/**
 * 要素（データ）コレクションのクライアント。
 * ページ用 `CollectionClientImpl` を内部に持ち、`list` / `get(id)` / `cache.invalidate` のみ公開する。
 * 本文レンダリング・slug ルックアップ・`params` は持たない。内部 identity は id。
 */
export class DataCollectionClientImpl<T extends BaseContentItem>
  implements DataCollectionClient<T>
{
  readonly cache: DataCollectionCacheOps;
  private readonly inner: CollectionClientImpl<T>;

  constructor(ctx: CollectionContext<T>) {
    this.inner = new CollectionClientImpl(ctx);
    this.cache = { invalidate: () => this.inner.cache.invalidate() };
  }

  /** データソースの表示名を取得する。DataSource が未対応なら undefined。 */
  getDbName(): Promise<string | undefined> {
    return this.inner.getDbName();
  }

  list(opts?: ListOptions<T>): Promise<T[]> {
    return this.inner.list(opts);
  }

  get(id: string): Promise<T | null> {
    return this.inner.getById(id);
  }

  /**
   * webhook 再検証で呼ばれる。対象 page がこのコレクションに属すならリストを作り直し、
   * その identity（id）を返す。属さなければ null。本文を持たないのでリストのみ更新する。
   */
  async warmByPageId(pageId: string): Promise<string | null> {
    const item = await this.inner.getById(pageId);
    if (!item) return null;
    await this.inner.revalidateList();
    return itemKey(item);
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
