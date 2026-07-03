/**
 * Cloudflare Workers 向けの実装を集約するエントリ(`KVNamespaceLike`/`R2BucketLike` は
 * 構造型のため `@cloudflare/workers-types` への実依存はない)。
 * 汎用の `.` エントリからは分離する — Node 専用ランタイム(Workers 以外)の利用者には
 * 不要な公開面のため。
 */
export { kvDocStore, r2BlobStore } from "./store/cloudflare.js";
export type {
  KVNamespaceLike,
  R2BucketLike,
  R2ObjectLike,
} from "./store/cloudflare-types.js";
