import type {
  PageObjectResponse,
  PartialPageObjectResponse,
} from "@notionhq/client";
import { isFullPage } from "@notionhq/client";
import { CMSError } from "../errors.js";
import { normalizeBlockTree } from "../pipeline/blocks.js";
import { extractImageRefs, parseImageDimensions } from "../pipeline/images.js";
import type { PageIndex } from "../pipeline/links.js";
import { normalizePageId, resolvePageLinks } from "../pipeline/links.js";
import { mapProperties, mapPropertyValue } from "../pipeline/properties.js";
import { resolveImageUrls } from "../pipeline/resolve-images.js";
import type { TransformStage } from "../pipeline/transform-stage.js";
import { runTransformStages } from "../pipeline/transform-stage.js";
import type { RealtimeAdapter } from "../realtime.js";
import { publishVersionUpdate } from "../realtime.js";
import type { EntryStore } from "../store/entry-store.js";
import type { IndexStore } from "../store/index-store.js";
import type { BlobStore } from "../store/types.js";
import type { CollectionDef } from "../types/collection.js";
import type { IndexEntry } from "../types/collection-index.js";
import type { ImageMapEntry } from "../types/entry-snapshot.js";
import type { JsonValue } from "../types/json-value.js";
import type { Logger } from "../types/logger.js";
import type { EntryChange } from "./coordinator.js";
import type { BlockChildrenListResult } from "./fetch-block-tree.js";
import { fetchBlockTree } from "./fetch-block-tree.js";
import type { RateLimiter } from "./rate-limiter.js";
import { DEFAULT_RETRY_CONFIG, type RetryConfig, withRetry } from "./retry.js";

/** `client.dataSources.query` が返す最小形状(構造型、モック可能)。 */
export interface DataSourceQueryResult {
  readonly results: readonly PageObjectResponse[];
  readonly next_cursor: string | null;
  readonly has_more: boolean;
}

/**
 * ドライバが必要とする Notion API の最小構造型。実 SDK の `Client` はこれを
 * 満たすが、テストでは `vi.fn` で実装した最小オブジェクトを直接渡せる。
 */
export interface NotionClientLike {
  dataSources: {
    query(args: {
      data_source_id: string;
      sorts?: ReadonlyArray<{
        timestamp: "last_edited_time";
        direction: "ascending" | "descending";
      }>;
      page_size?: number;
      start_cursor?: string;
    }): Promise<DataSourceQueryResult>;
  };
  pages: {
    retrieve(args: {
      page_id: string;
    }): Promise<PageObjectResponse | PartialPageObjectResponse>;
  };
  blocks: {
    children: {
      list(args: {
        block_id: string;
        page_size?: number;
        start_cursor?: string;
      }): Promise<BlockChildrenListResult>;
    };
  };
}

export interface CollectionDriverDeps {
  /** schema 上のコレクションキー(合成層が slug 名前空間化に使う)。 */
  readonly collection: string;
  // biome-ignore lint/suspicious/noExplicitAny: 「何らかの CollectionDef」を表す型消去用途（types/collection.ts の CollectionMap と同じ意図）。
  readonly def: CollectionDef<any>;
  readonly client: NotionClientLike;
  /** 全コレクション・全 Notion 呼び出しで共有するレートリミッタ(3req/s)。 */
  readonly rateLimiter: RateLimiter;
  readonly retry?: RetryConfig;
  readonly entryStore: EntryStore;
  readonly indexStore: IndexStore;
  /** entry 本体と同じ R2(想定)。画像も `image/{hash}` キーで書き込む。 */
  readonly blobs: BlobStore;
  readonly transforms?: readonly TransformStage[];
  /** 画像プロキシの配信パス。既定 `/images`。 */
  readonly imagesPath?: string;
  /** 内部リンク解決用の PageIndex(スキーマ全体を横断する合成層が提供)。 */
  readonly pageIndex?: () => Promise<PageIndex>;
  readonly fetchImpl?: typeof fetch;
  /** 同期完了時に version 同梱で push する(#437 ADR-5)。省略時は push しない。 */
  readonly realtime?: RealtimeAdapter;
  readonly logger?: Logger;
}

export interface CollectionDriver {
  listChanged(
    notionCursor: string | null,
    limit: number,
  ): Promise<{ changes: readonly EntryChange[]; nextCursor: string | null }>;
  listAllSlugs(): Promise<readonly string[]>;
  listIndexedSlugs(): Promise<readonly string[]>;
  syncEntry(change: EntryChange): Promise<void>;
  removeEntry(slug: string): Promise<void>;
}

function slugOf(
  // biome-ignore lint/suspicious/noExplicitAny: 型消去された CollectionDef を受け取る。
  def: CollectionDef<any>,
  page: PageObjectResponse,
): string | null {
  const slugKey = def.slug as string;
  const propDef = def.properties[slugKey];
  if (!propDef) return null;
  const raw = (page.properties as Record<string, unknown>)[
    propDef.notion ?? slugKey
  ];
  const value = mapPropertyValue(
    propDef.kind,
    raw as Parameters<typeof mapPropertyValue>[1],
  );
  return typeof value === "string" && value.length > 0 ? value : null;
}

function statusOf(
  // biome-ignore lint/suspicious/noExplicitAny: 型消去された CollectionDef を受け取る。
  def: CollectionDef<any>,
  page: PageObjectResponse,
): string | null {
  if (!def.statusProperty) return null;
  const statusKey = def.statusProperty as string;
  const propDef = def.properties[statusKey];
  const raw = (page.properties as Record<string, unknown>)[
    propDef?.notion ?? statusKey
  ];
  const value = mapPropertyValue(
    "status",
    raw as Parameters<typeof mapPropertyValue>[1],
  );
  return typeof value === "string" ? value : null;
}

// biome-ignore lint/suspicious/noExplicitAny: 型消去された CollectionDef を受け取る。
function isAccessible(def: CollectionDef<any>, status: string | null): boolean {
  if (!def.statusProperty) return true;
  const effectiveAccessible = def.accessible ?? def.published;
  if (!effectiveAccessible) return true;
  return status !== null && effectiveAccessible.includes(status);
}

// biome-ignore lint/suspicious/noExplicitAny: 型消去された CollectionDef を受け取る。
function isListed(def: CollectionDef<any>, status: string | null): boolean {
  if (!def.statusProperty || !def.published) return true;
  return status !== null && def.published.includes(status);
}

/**
 * 1 コレクション分の Notion ドライバ(#437 マルチソース同期の中核)。
 * `SyncCoordinatorDeps`(coordinator.ts、無改修)の実装を 1 コレクション分だけ提供する。
 * 複数コレクションを束ねる合成は `multi-source.ts` が担う。
 */
export function createCollectionDriver(
  deps: CollectionDriverDeps,
): CollectionDriver {
  const { collection, def, client, rateLimiter, retry, logger } = deps;
  const imagesPath = deps.imagesPath ?? "/images";
  const fetchImpl = deps.fetchImpl ?? fetch;
  // logger 指定時はリトライ待機を debug ログに流す（利用者の onRetry も温存する）。
  const baseRetry = retry ?? DEFAULT_RETRY_CONFIG;
  const effectiveRetry: RetryConfig | undefined = logger
    ? {
        ...baseRetry,
        onRetry: (attempt, status, delayMs) => {
          baseRetry.onRetry?.(attempt, status, delayMs);
          logger.debug?.("notion API をリトライします", {
            operation: "retry",
            collection,
            attempt,
            status,
            backoffMs: delayMs,
          });
        },
      }
    : retry;
  // listChanged で取得した PageObjectResponse を同一チャンク内だけ再利用するキャッシュ。
  // coordinator は同一 runChunk() 内で listChanged 直後に syncEntry を呼ぶため、
  // 追加の Notion 呼び出し無しで page を渡せる(#437 の設計判断)。
  let chunkCache = new Map<string, PageObjectResponse>();
  // listChanged が差分判定のために読んだ index 点キーの値も同様に持ち回り、
  // syncEntry → upsertEntry での同一キー再読み込み(KV read の二重化)を省く。
  // null は「存在しないことを確認済み」、キー不在は「未読(upsert 側で読み直す)」。
  let chunkIndexCache = new Map<string, IndexEntry | null>();

  type QueryArgs = Omit<
    Parameters<NotionClientLike["dataSources"]["query"]>[0],
    "data_source_id"
  >;

  async function queryDataSource(
    args: QueryArgs,
  ): Promise<DataSourceQueryResult> {
    try {
      return await withRetry(
        () =>
          rateLimiter.schedule(() =>
            client.dataSources.query({
              data_source_id: def.dataSourceId,
              ...args,
            }),
          ),
        effectiveRetry,
      );
    } catch (err) {
      logger?.error?.("data source query に失敗しました", {
        operation: "listChanged",
        collection,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new CMSError({
        code: "sync/notion_query_failed",
        message: `data source query に失敗しました(collection: ${collection})`,
        cause: err,
        context: { operation: "listChanged", collection },
      });
    }
  }

  async function retrieveByPageIdFallback(
    pageId: string,
  ): Promise<PageObjectResponse | null> {
    try {
      const page = await withRetry(
        () =>
          rateLimiter.schedule(() =>
            client.pages.retrieve({ page_id: pageId }),
          ),
        effectiveRetry,
      );
      return isFullPage(page) ? page : null;
    } catch {
      return null;
    }
  }

  async function resolveImage(ref: {
    hash: string;
    url: string;
  }): Promise<ImageMapEntry> {
    const key = `image/${ref.hash}`;
    const existing = await deps.blobs.head(key);
    if (existing) {
      // put 時に寸法を customMetadata へ保存してあれば、寸法再計算のための
      // 本体ダウンロード(R2 Class B + 帯域)を丸ごと省略できる。
      // 保存前の既存画像(キー無し)は従来どおり本体から再計算する。
      const md = existing.customMetadata;
      if (md && "width" in md) {
        return {
          hash: ref.hash,
          width: md.width ? Number(md.width) : null,
          height: md.height ? Number(md.height) : null,
          contentType: existing.contentType ?? "application/octet-stream",
        };
      }
      const bytes = (await deps.blobs.get(key)) ?? new Uint8Array(0);
      const dims = parseImageDimensions(bytes);
      return {
        hash: ref.hash,
        width: dims.width,
        height: dims.height,
        contentType:
          existing.contentType ??
          dims.contentType ??
          "application/octet-stream",
      };
    }

    // Notion の署名付き URL は一過性の 429/5xx を返すことがあるため、Notion API と
    // 同じバックオフ設定でリトライする。それ以外のステータスは従来どおり素通しする。
    const retryCfg = effectiveRetry ?? DEFAULT_RETRY_CONFIG;
    const res = await withRetry(async () => {
      const r = await fetchImpl(ref.url);
      if (retryCfg.retryOn.includes(r.status)) {
        throw Object.assign(
          new CMSError({
            code: "sync/image_fetch_failed",
            message: `画像の取得に失敗しました(${r.status}): ${ref.url}`,
            context: { operation: "resolveImage", collection },
          }),
          { status: r.status },
        );
      }
      return r;
    }, retryCfg);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? undefined;
    const dims = parseImageDimensions(bytes);
    await deps.blobs.put(key, bytes, {
      contentType,
      // 空文字は「解析済みだが寸法不明(SVG 等)」の印。次回同期はキーの存在だけ見て
      // 本体ダウンロードをスキップする。
      customMetadata: {
        width: dims.width != null ? String(dims.width) : "",
        height: dims.height != null ? String(dims.height) : "",
      },
    });
    return {
      hash: ref.hash,
      width: dims.width,
      height: dims.height,
      contentType:
        contentType ?? dims.contentType ?? "application/octet-stream",
    };
  }

  return {
    async listChanged(notionCursor, limit) {
      const res = await queryDataSource({
        sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
        page_size: limit,
        start_cursor: notionCursor ?? undefined,
      });
      const pages = res.results.filter(isFullPage);

      // チャンクサイズ(既定 2 件程度)ぶんの点読みで済ませる。マニフェストは
      // 内容編集のみの更新では version を更新しない(index-store.ts 参照)ため、
      // ここで一覧側の version と比較すると内容編集の同期漏れになる。
      const nextChunkCache = new Map<string, PageObjectResponse>();
      const nextChunkIndexCache = new Map<string, IndexEntry | null>();
      const changes: EntryChange[] = [];
      let stoppedEarly = false;
      for (const page of pages) {
        const slug = slugOf(def, page) ?? page.id;
        nextChunkCache.set(slug, page);
        const existing = await deps.indexStore.findEntry(collection, slug);
        nextChunkIndexCache.set(slug, existing);
        if (existing && existing.version === page.last_edited_time) {
          stoppedEarly = true;
          break;
        }
        changes.push({ slug, lastEditedTime: page.last_edited_time });
      }
      chunkCache = nextChunkCache;
      chunkIndexCache = nextChunkIndexCache;

      const nextCursor = stoppedEarly
        ? null
        : res.has_more
          ? (res.next_cursor ?? null)
          : null;
      return { changes, nextCursor };
    },

    async listAllSlugs() {
      const results: PageObjectResponse[] = [];
      let cursor: string | undefined;
      do {
        const res = await queryDataSource({
          page_size: 100,
          start_cursor: cursor,
        });
        results.push(...res.results.filter(isFullPage));
        cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
      } while (cursor);
      return results
        .filter((page) => isAccessible(def, statusOf(def, page)))
        .map((page) => slugOf(def, page) ?? page.id);
    },

    async listIndexedSlugs() {
      return deps.indexStore.listSlugs(collection);
    },

    async syncEntry(change) {
      const page =
        chunkCache.get(change.slug) ??
        (await retrieveByPageIdFallback(change.slug));
      if (!page) {
        throw new CMSError({
          code: "sync/notion_query_failed",
          message: `slug "${change.slug}" に対応する Notion ページが見つかりません`,
          context: { operation: "syncEntry", collection, slug: change.slug },
        });
      }

      const status = statusOf(def, page);
      const rawSlug = slugOf(def, page);
      if (!isAccessible(def, status)) {
        const slugForRemoval = rawSlug ?? page.id;
        await deps.entryStore.delete(collection, slugForRemoval);
        await deps.indexStore.removeEntry(collection, slugForRemoval);
        return;
      }
      // slug プロパティを設定しているのに値が空 = 設定ミス（壊れた URL を生む）なので弾く。
      // slug 未設定のコレクション（設定値一覧等）は page id をキーにするため throw しない。
      if (def.slug && !rawSlug) {
        throw new CMSError({
          code: "sync/slug_missing",
          message: `collection "${collection}" のページに slug がありません(page: ${page.id})`,
          context: { operation: "syncEntry", collection, slug: page.id },
        });
      }
      const slug = rawSlug ?? page.id;

      const fetchedBlocks = await fetchBlockTree(client, page.id, {
        rateLimiter,
        retry: effectiveRetry,
      });
      const normalized = normalizeBlockTree(fetchedBlocks);
      const imageRefs = await extractImageRefs(normalized);
      const images: Record<string, ImageMapEntry> = {};
      for (const ref of imageRefs) {
        images[ref.hash] = await resolveImage(ref);
      }
      const withImages = await resolveImageUrls(normalized, images, imagesPath);
      const transformed = await runTransformStages(
        withImages,
        deps.transforms ?? [],
      );

      const mappedProps = mapProperties(
        def.properties,
        page.properties,
      ) as Record<string, JsonValue>;
      const meta: Record<string, JsonValue> = {
        id: normalizePageId(page.id),
        slug,
        lastEditedTime: page.last_edited_time,
        ...mappedProps,
      };

      const pageIndex = (await deps.pageIndex?.()) ?? {};
      const links = resolvePageLinks(transformed, pageIndex);

      await deps.entryStore.put({
        collection,
        slug,
        version: page.last_edited_time,
        meta,
        blocks: transformed,
        images,
        links,
      });
      await deps.indexStore.upsertEntry(
        collection,
        {
          slug,
          version: page.last_edited_time,
          listed: isListed(def, status),
          meta,
        },
        chunkIndexCache.has(slug)
          ? (chunkIndexCache.get(slug) ?? null)
          : undefined,
      );

      if (deps.realtime) {
        await publishVersionUpdate(
          deps.realtime,
          collection,
          slug,
          page.last_edited_time,
        );
      }

      logger?.debug?.("entry を materialize しました", {
        operation: "syncEntry",
        collection,
        slug,
        pageId: page.id,
      });
    },

    async removeEntry(slug) {
      await deps.entryStore.delete(collection, slug);
      await deps.indexStore.removeEntry(collection, slug);
    },
  };
}
