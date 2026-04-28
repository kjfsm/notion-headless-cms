import type {
  BaseContentItem,
  CachedItemContent,
  CachedItemList,
  CachedItemMeta,
  DocumentCacheOps,
  ImageCacheOps,
  StorageBinary,
} from "../types/index";

/** 何もキャッシュしないドキュメントオペレーション。常に null を返す。 */
const noopDoc: DocumentCacheOps = {
  getList<T extends BaseContentItem>(
    _collection: string,
  ): Promise<CachedItemList<T> | null> {
    return Promise.resolve(null);
  },
  setList<T extends BaseContentItem>(
    _collection: string,
    _data: CachedItemList<T>,
  ): Promise<void> {
    return Promise.resolve();
  },
  getMeta<T extends BaseContentItem>(
    _collection: string,
    _slug: string,
  ): Promise<CachedItemMeta<T> | null> {
    return Promise.resolve(null);
  },
  setMeta<T extends BaseContentItem>(
    _collection: string,
    _slug: string,
    _data: CachedItemMeta<T>,
  ): Promise<void> {
    return Promise.resolve();
  },
  getContent(
    _collection: string,
    _slug: string,
  ): Promise<CachedItemContent | null> {
    return Promise.resolve(null);
  },
  setContent(
    _collection: string,
    _slug: string,
    _data: CachedItemContent,
  ): Promise<void> {
    return Promise.resolve();
  },
  invalidate(): Promise<void> {
    return Promise.resolve();
  },
};

/** 何もキャッシュしない画像オペレーション。 */
const noopImg: ImageCacheOps = {
  get(_hash: string): Promise<StorageBinary | null> {
    return Promise.resolve(null);
  },
  set(): Promise<void> {
    return Promise.resolve();
  },
};

/**
 * 何もキャッシュしないアダプタ。`createCMS({ cache })` 未指定時の内部デフォルト。
 * テストでも使える。
 */
export const noopDocOps: DocumentCacheOps = noopDoc;
export const noopImgOps: ImageCacheOps = noopImg;
