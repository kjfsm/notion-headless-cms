/**
 * コレクション index の読み書き（KV 想定）。構造型なので `@cloudflare/workers-types`
 * に実依存しない（v2 の `KVNamespaceLike` パターンを継承）。
 *
 * Cloudflare KV はグローバルに結果整合（最大 60 秒程度の伝播遅延がありうる）で、
 * `BlobStore`(R2)のような read-after-write 強整合ではない。同一リージョンからの
 * 直後の読み取りは新しい値が見えることが多いが、それを前提にした実装をしないこと
 * （`find()` の versioned cache キーが古い version を指し続ける等の形で顕在化しうる）。
 */
export interface DocStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface BlobPutOptions {
  readonly contentType?: string;
  /** 本体を読まずに head だけで参照したい付加情報（画像寸法等）。実装が対応する場合のみ永続化される。 */
  readonly customMetadata?: Readonly<Record<string, string>>;
}

export interface BlobHead {
  readonly contentType?: string;
  readonly size: number;
  /** put 時に渡した `customMetadata`。対応しない実装では undefined。 */
  readonly customMetadata?: Readonly<Record<string, string>>;
}

export interface BlobGetResult {
  readonly bytes: Uint8Array;
  readonly contentType?: string;
}

/**
 * entry 本体・画像バイナリの読み書き（R2 想定）。read-after-write 強整合を前提にする
 * （#437 ADR-1: entry 本体を R2 に置く理由）。
 */
export interface BlobStore {
  get(key: string): Promise<Uint8Array | null>;
  /**
   * 本体とメタデータを 1 回の読み取りで返す（画像配信で get+head の 2 オペレーションを
   * 1 回に抑えるための任意メソッド）。未実装の場合、呼び出し側は get+head にフォールバックする。
   */
  getWithMetadata?(key: string): Promise<BlobGetResult | null>;
  put(key: string, value: Uint8Array, opts?: BlobPutOptions): Promise<void>;
  /** 本体を取得せずメタデータのみ確認する（存在確認・重複 fetch 回避用）。 */
  head(key: string): Promise<BlobHead | null>;
  delete(key: string): Promise<void>;
}
