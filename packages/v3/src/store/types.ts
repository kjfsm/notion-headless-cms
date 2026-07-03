/**
 * コレクション index の読み書き（KV 想定）。構造型なので `@cloudflare/workers-types`
 * に実依存しない（v2 の `KVNamespaceLike` パターンを継承）。
 */
export interface DocStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  /** 前方一致でキー一覧を取得する（シャード列挙に使う）。 */
  list(prefix: string): Promise<readonly string[]>;
  delete(key: string): Promise<void>;
}

export interface BlobPutOptions {
  readonly contentType?: string;
}

export interface BlobHead {
  readonly contentType?: string;
  readonly size: number;
}

/**
 * entry 本体・画像バイナリの読み書き（R2 想定）。read-after-write 強整合を前提にする
 * （#437 ADR-1: entry 本体を R2 に置く理由）。
 */
export interface BlobStore {
  get(key: string): Promise<Uint8Array | null>;
  put(key: string, value: Uint8Array, opts?: BlobPutOptions): Promise<void>;
  /** 本体を取得せずメタデータのみ確認する（存在確認・重複 fetch 回避用）。 */
  head(key: string): Promise<BlobHead | null>;
  delete(key: string): Promise<void>;
}
