import type { JsonValue } from "./json-value.js";

/**
 * KV の 1 コレクション分の index。list() 評価に必要な最小メタのみを持つ
 * （本文は含めない — 本文は R2 の `EntrySnapshot` 側）。
 * KV 25MB 制限とサイズ予算を考慮し、1 コレクションを複数ページに
 * シャーディングする前提（`index:{collection}:{page}` キー）。
 */
export interface IndexEntry {
  readonly slug: string;
  /** `EntrySnapshot.version` と同じ値。KV 側の鮮度判定に使う。 */
  readonly version: string;
  /** false の場合は限定公開（find は通すが list からは隠す）。 */
  readonly listed: boolean;
  /** where/sort 評価に必要なプロパティ値のみを持つ縮小版メタ。 */
  readonly meta: JsonValue;
}

export interface CollectionIndex {
  readonly collection: string;
  readonly page: number;
  readonly entries: readonly IndexEntry[];
}
