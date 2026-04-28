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
 * 統一キャッシュアダプタ。`handles` で担当領域を申告し、
 * `doc` / `img` のいずれか（または両方）を実装する。
 *
 * `createCMS({ cache })` には `CacheAdapter | CacheAdapter[]` を渡せる。
 * 配列で渡された場合、core は `handles` を見て document / image をそれぞれ別アダプタに振り分ける。
 *
 * @example
 * cache: memoryCache()                           // doc + image 両方
 * cache: r2Cache({ bucket })                      // image のみ
 * cache: kvCache({ namespace })                   // document のみ
 * cache: [kvCache({ ns }), r2Cache({ bucket })]   // 個別に組み合わせ
 */
export interface CacheAdapter {
  readonly name: string;
  readonly handles: readonly ("document" | "image")[];
  doc?: DocumentCacheOps;
  img?: ImageCacheOps;
}
