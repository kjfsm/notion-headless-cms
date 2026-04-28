import type { CMSError } from "../errors";
import type {
  BaseContentItem,
  CachedItemContent,
  CachedItemList,
  CachedItemMeta,
} from "./content";

export type MaybePromise<T> = T | Promise<T>;

export interface CMSHooks<T extends BaseContentItem = BaseContentItem> {
  /**
   * 本文キャッシュ書き込み直前に呼ばれる。html を加工したい場合などに使う。
   * 戻り値が新しい `CachedItemContent` として保存される。
   */
  beforeCacheContent?(
    content: CachedItemContent,
    item: T,
  ): MaybePromise<CachedItemContent>;
  /** メタデータキャッシュ書き込み直前に呼ばれる。 */
  beforeCacheMeta?(meta: CachedItemMeta<T>): MaybePromise<CachedItemMeta<T>>;
  afterRender?(html: string, item: T): MaybePromise<string>;
  onCacheHit?(slug: string, meta: CachedItemMeta<T>): void;
  onCacheMiss?(slug: string): void;
  /** SWR バックグラウンド差分チェックで更新を検出し、メタを差し替えたときに呼ばれる。 */
  onCacheRevalidated?(slug: string, meta: CachedItemMeta<T>): void;
  /** 本文キャッシュが（lazy ロード or バックグラウンド再生成で）更新されたときに呼ばれる。 */
  onContentRevalidated?(slug: string, content: CachedItemContent): void;
  onListCacheHit?(list: CachedItemList<T>): void;
  onListCacheMiss?(): void;
  /** SWR バックグラウンド差分チェックでリスト更新を検出し、キャッシュを差し替えたときに呼ばれる。 */
  onListCacheRevalidated?(list: CachedItemList<T>): void;
  onError?(error: Error): void;
  onRenderStart?(slug: string): void;
  onRenderEnd?(slug: string, durationMs: number): void;
  /**
   * SWR バックグラウンド処理（差分チェック / 本文再生成）の失敗ハンドラ。
   * これらは UI に伝搬させずに握り続ける必要があるため、エラーを補足するには
   * この hook を実装する。実装しない場合、エラーは logger.warn のみで消える。
   */
  onSwrError?(
    error: CMSError,
    ctx: { phase: "item-meta" | "item-content" | "list"; slug?: string },
  ): void;
}
