import type { JsonValue } from "./json-value.js";

/**
 * KV の 1 コレクション分の index エントリ。list() 評価用のメタのみを持つ
 * （本文は含めない — 本文は R2 の `EntrySnapshot` 側）。
 */
export interface IndexEntry {
  readonly slug: string;
  /** `EntrySnapshot.version` と同じ値。KV 側の鮮度判定に使う。 */
  readonly version: string;
  /** false の場合は限定公開（find は通すが list からは隠す）。 */
  readonly listed: boolean;
  /**
   * エントリのメタ（`id`/`slug`/`lastEditedTime` + マップ済み全プロパティ）。
   * ドライバ(`notion-driver.ts` の `syncEntry`)が R2 本体と同一の meta を書き込むため、
   * `list()` はこれを `CollectionIndexEntry<C>` で `InferEntry<C>` に型付けできる。
   * この不変条件（index に full meta が入る）を崩す場合は当該型も射影に合わせて変えること。
   */
  readonly meta: JsonValue;
}
