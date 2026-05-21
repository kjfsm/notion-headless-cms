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
 *
 * core 側の役割:
 * - SWR ロジックは core の `CollectionClient` が制御し、TTL 切れの判定や差分検出を行う。
 *   adapter は読み書きと無効化を実装するだけ。
 * - `invalidate(scope)` の `scope` は `"all"`、コレクション全体、または単一 slug の 3 形態。
 *   `kind: "meta" | "content" | "all"` で削除粒度を指定する。
 *
 * adapter 側で気をつけること:
 * - I/O 失敗は `CMSError(code: "cache/io_failed")` でラップしてから throw する (生の Error を投げない)
 * - 値は JSON シリアライズ可能とは限らない (例: `CachedItemContent.bodyHtml`)。バイナリ安全に保存する
 * - 並列書き込みは core では制御しないので、必要なら adapter 内部でロック / トランザクションを取る
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

/**
 * 画像キャッシュ用のオペレーション群。`CacheAdapter.img` に実装する。
 *
 * 責務境界:
 * - hash 計算と HTTP fetch は core (`fetchAndCacheImage` / `buildCacheImageFn`) が担当する。
 *   adapter は `hash` をキーにしたバイナリの永続化だけを担う。
 * - `RenderContext.cacheImage(url)` (=`cms.cacheImage`) は core 側の合成関数で、
 *   「URL → SHA256 → adapter.set → プロキシ URL」を 1 ステップにまとめたもの。
 *   adapter から呼び出してはいけない (依存方向の逆転になる)。
 * - 読み取りは miss を `null` で返す。例外を投げないこと (上位の SWR が壊れる)。
 * - 書き込みは I/O 失敗時に `CMSError(code: "cache/io_failed")` でラップ可能だが、
 *   画像系は fail-soft 推奨 (失敗時は通常 fetch にフォールバックする想定)。
 */
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
 * `createClient({ cache })` には `CacheAdapter[]` を渡す (単一 adapter でも配列で渡す)。
 *
 * `handles` の判定ルール:
 * - core は配列を先頭から走査し、`handles.includes("document")` を満たす最初の adapter を
 *   document 担当に、`handles.includes("image")` を満たす最初の adapter を image 担当に割り当てる
 * - 同じ adapter が両方の `handles` を持つ場合は単独で両領域を担当する (memoryCache はこの形)
 * - 領域を申告する一方で対応する `doc` / `img` を実装していない場合、その領域では先勝ちにならず
 *   次の adapter が候補になる
 *
 * @example
 * cache: [memoryCache()]                          // doc + image 両方
 * cache: [r2Cache({ bucket })]                    // image のみ
 * cache: [kvCache({ namespace })]                 // document のみ
 * cache: [kvCache({ ns }), r2Cache({ bucket })]   // KV: doc / R2: image を個別配線
 *
 * オプションの `stats()` を実装すると `cms.stats()` 経由でヒット率・サイズが取得できる。
 * 未実装の adapter は集計から除外される (`cms.stats()` の戻り値で undefined になる)。
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
