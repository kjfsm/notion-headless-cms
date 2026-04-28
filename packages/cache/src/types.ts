// Cloudflare R2 / KV の最小インターフェース。
// 実装詳細は @cloudflare/workers-types に依存せず、構造的サブタイプで互換にする。
// Workers の R2Bucket / KVNamespace はそのまま渡せる。

/** R2 オブジェクトの最小インターフェース。 */
export interface R2ObjectLike {
  json<T>(): Promise<T>;
  arrayBuffer(): Promise<ArrayBuffer>;
  httpMetadata?: { contentType?: string };
}

/** R2 list() の戻り値の最小インターフェース。 */
export interface R2ListResult {
  objects: { key: string }[];
  truncated: boolean;
  cursor?: string;
}

/** R2Bucket の最小インターフェース。 */
export interface R2BucketLike {
  get(key: string): Promise<R2ObjectLike | null>;
  put(
    key: string,
    value: ArrayBuffer | string,
    opts?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<unknown>;
  list(opts?: { prefix?: string; cursor?: string }): Promise<R2ListResult>;
}

/** KVNamespace の最小インターフェース。 */
export interface KVNamespaceLike {
  get(key: string, type: "text"): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts?: { prefix?: string; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}
