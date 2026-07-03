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
import type { EntryStore } from "../store/entry-store.js";
import type { IndexStore } from "../store/index-store.js";
import type { BlobStore } from "../store/types.js";
import type { CollectionDef } from "../types/collection.js";
import type { ImageMapEntry } from "../types/entry-snapshot.js";
import type { JsonValue } from "../types/json-value.js";
import type { EntryChange } from "./coordinator.js";
import type { BlockChildrenListResult } from "./fetch-block-tree.js";
import { fetchBlockTree } from "./fetch-block-tree.js";
import type { RateLimiter } from "./rate-limiter.js";
import type { RetryConfig } from "./retry.js";
import { withRetry } from "./retry.js";

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
  const raw = (page.properties as Record<string, unknown>)[slugKey];
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
  const raw = (page.properties as Record<string, unknown>)[
    def.statusProperty as string
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
  const { collection, def, client, rateLimiter, retry } = deps;
  const imagesPath = deps.imagesPath ?? "/images";
  const fetchImpl = deps.fetchImpl ?? fetch;
  // listChanged で取得した PageObjectResponse を同一チャンク内だけ再利用するキャッシュ。
  // coordinator は同一 runChunk() 内で listChanged 直後に syncEntry を呼ぶため、
  // 追加の Notion 呼び出し無しで page を渡せる(#437 の設計判断)。
  let chunkCache = new Map<string, PageObjectResponse>();

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
        retry,
      );
    } catch (err) {
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
        retry,
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
    let bytes: Uint8Array;
    let contentType: string | undefined;
    if (existing) {
      bytes = (await deps.blobs.get(key)) ?? new Uint8Array(0);
      contentType = existing.contentType;
    } else {
      const res = await fetchImpl(ref.url);
      bytes = new Uint8Array(await res.arrayBuffer());
      contentType = res.headers.get("content-type") ?? undefined;
      await deps.blobs.put(key, bytes, { contentType });
    }
    const dims = parseImageDimensions(bytes);
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

      const shards = await deps.indexStore.listShards(collection);
      const indexedBySlug = new Map(
        shards.flatMap((s) => s.entries).map((e) => [e.slug, e]),
      );

      const nextChunkCache = new Map<string, PageObjectResponse>();
      const changes: EntryChange[] = [];
      let stoppedEarly = false;
      for (const page of pages) {
        const slug = slugOf(def, page) ?? page.id;
        nextChunkCache.set(slug, page);
        const existing = indexedBySlug.get(slug);
        if (existing && existing.version === page.last_edited_time) {
          stoppedEarly = true;
          break;
        }
        changes.push({ slug, lastEditedTime: page.last_edited_time });
      }
      chunkCache = nextChunkCache;

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
      const shards = await deps.indexStore.listShards(collection);
      return shards.flatMap((s) => s.entries.map((e) => e.slug));
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
      if (!rawSlug) {
        throw new CMSError({
          code: "sync/slug_missing",
          message: `collection "${collection}" のページに slug がありません(page: ${page.id})`,
          context: { operation: "syncEntry", collection, slug: page.id },
        });
      }
      const slug = rawSlug;

      const fetchedBlocks = await fetchBlockTree(client, page.id, {
        rateLimiter,
        retry,
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
      await deps.indexStore.upsertEntry(collection, {
        slug,
        version: page.last_edited_time,
        listed: isListed(def, status),
        meta,
      });
    },

    async removeEntry(slug) {
      await deps.entryStore.delete(collection, slug);
      await deps.indexStore.removeEntry(collection, slug);
    },
  };
}
