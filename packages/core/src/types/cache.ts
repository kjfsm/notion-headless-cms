import type {
  BaseContentItem,
  CachedItemContent,
  CachedItemList,
  CachedItemMeta,
  StorageBinary,
} from "./content";
import type { InvalidateScope } from "./data-source";

export type { InvalidateKind, InvalidateScope } from "./data-source";

/**
 * ドキュメントキャッシュ用のオペレーション群。
 * `CacheAdapter.doc` に実装する。collection 名は引数で渡されるので、
 * アダプタ側で `{collection}:{slug}` のようなキー戦略を組み立てる。
 */
export interface DocumentCacheOps {
  getList<T extends BaseContentItem>(
    collection: string,
  ): Promise<CachedItemList<T> | null>;
  setList<T extends BaseContentItem>(
    collection: string,
    data: CachedItemList<T>,
  ): Promise<void>;
  getMeta<T extends BaseContentItem>(
    collection: string,
    slug: string,
  ): Promise<CachedItemMeta<T> | null>;
  setMeta<T extends BaseContentItem>(
    collection: string,
    slug: string,
    data: CachedItemMeta<T>,
  ): Promise<void>;
  getContent(
    collection: string,
    slug: string,
  ): Promise<CachedItemContent | null>;
  setContent(
    collection: string,
    slug: string,
    data: CachedItemContent,
  ): Promise<void>;
  invalidate(scope: InvalidateScope): Promise<void>;
}

/** 画像キャッシュ用のオペレーション群。`CacheAdapter.img` に実装する。 */
export interface ImageCacheOps {
  get(hash: string): Promise<StorageBinary | null>;
  set(hash: string, data: ArrayBuffer, contentType: string): Promise<void>;
}

/**
 * 1 領域 (document / image) ぶんのキャッシュ統計。
 * `CacheAdapter.stats()` の戻り値 / `cms.stats()` の集約形に使う。
 */
export interface CacheAreaStats {
  /** キャッシュヒット回数 (起動から累積)。 */
  hits: number;
  /** キャッシュミス回数 (起動から累積)。 */
  misses: number;
  /** 保持エントリ数。集計不可な adapter は省略可。 */
  entries?: number;
  /** 保持データの合計バイト数。集計不可な adapter は省略可。 */
  sizeBytes?: number;
}

/**
 * `CacheAdapter.stats()` が返す統計。document / image を併せ持つ adapter は両方を返す。
 * adapter が `handles` に含めていない領域は省略する。
 */
export interface CacheAdapterStats {
  /** adapter 名 (`CacheAdapter.name` と同値)。`cms.stats()` 側で識別用に保持する。 */
  name?: string;
  doc?: CacheAreaStats;
  img?: CacheAreaStats;
}

/**
 * 統一キャッシュアダプタ。`handles` で担当領域を申告し、
 * `doc` / `img` のいずれか（または両方）を実装する。
 *
 * `createClient({ cache })` には `CacheAdapter | CacheAdapter[]` を渡せる。
 * 配列で渡された場合、core は `handles` を見て document / image をそれぞれ別アダプタに振り分ける。
 *
 * @example
 * cache: memoryCache()                           // doc + image 両方
 * cache: r2Cache({ bucket })                      // image のみ
 * cache: kvCache({ namespace })                   // document のみ
 * cache: [kvCache({ ns }), r2Cache({ bucket })]   // 個別に組み合わせ
 *
 * オプションの `stats()` を実装すると `cms.stats()` 経由でヒット率・サイズが取得できる。
 * 未実装の adapter はそのまま動作する。
 */
export interface CacheAdapter {
  readonly name: string;
  readonly handles: readonly ("document" | "image")[];
  doc?: DocumentCacheOps;
  img?: ImageCacheOps;
  /**
   * キャッシュ統計を返す任意のフック。
   * adapter が hit/miss を集計していない場合は実装しない (cms.stats() 側で無視される)。
   */
  stats?(): Promise<CacheAdapterStats>;
}
