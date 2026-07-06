/**
 * R2Bucket の最小構造型(v2 `packages/cache/src/types.ts` の方式を継承)。
 * `@cloudflare/workers-types` に実依存しない — 実 `R2Bucket` は構造的にこれを満たすので、
 * Workers の `env.XXX` をそのまま渡せる。KV 由来の構造型(`KVNamespaceLike`)は D1 移行に伴い
 * 廃止 — index 用ストレージは `@notion-headless-cms/sql` の D1/SQLite/libSQL 実装を使う。
 */
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
