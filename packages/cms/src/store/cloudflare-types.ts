/**
 * KVNamespace / R2Bucket の最小構造型(v2 `packages/cache/src/types.ts` の方式を継承)。
 * `@cloudflare/workers-types` に実依存しない — 実 `KVNamespace`/`R2Bucket` はどちらも
 * 構造的にこれらを満たすので、Workers の `env.XXX` をそのまま渡せる。
 */
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

export interface R2ObjectLike {
  arrayBuffer(): Promise<ArrayBuffer>;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
  size?: number;
}

export interface R2HeadResultLike {
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
  size?: number;
}

export interface R2BucketLike {
  get(key: string): Promise<R2ObjectLike | null>;
  head?(key: string): Promise<R2HeadResultLike | null>;
  put(
    key: string,
    value: ArrayBuffer | Uint8Array,
    opts?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  delete(key: string): Promise<unknown>;
}
