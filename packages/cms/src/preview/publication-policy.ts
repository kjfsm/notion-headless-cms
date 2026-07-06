import type { CollectionDef } from "../types/collection.js";

export interface PublicationDecision {
  /** find は通す(accessible)かどうか。false ならマテリアライズ・保存自体をスキップしてよい。 */
  readonly accessible: boolean;
  /** list / sitemap / RSS 等に載せる(published)かどうか。 */
  readonly listed: boolean;
}

/**
 * `CollectionDef` の `published`/`accessible` とエントリの実際の status 値から、
 * 公開ポリシーを一貫して判定する。
 *
 * - `published` にある値 → `accessible: true, listed: true`
 * - `accessible` にはあるが `published` にはない値 → `accessible: true, listed: false`(限定公開)
 * - どちらにも無い値(下書き等) → `accessible: false, listed: false`
 * - `statusProperty` 未指定のコレクション → 常に公開(`accessible: true, listed: true`)
 *
 * 「設定が黙って無視される経路を作らない」という #437 の設計判断により、
 * `accessible` 未指定時は `published` と同じ集合にフォールバックする
 * (accessible のみ限定公開したい場合は明示的に指定する)。
 */
// biome-ignore lint/suspicious/noExplicitAny: 「何らかの CollectionDef」を受け取る用途(types/collection.ts の CollectionMap と同じ意図)。
export function decidePublication(
  collection: CollectionDef<any>,
  statusValue: string | undefined,
): PublicationDecision {
  if (!collection.statusProperty) {
    return { accessible: true, listed: true };
  }
  const published = collection.published ?? [];
  const accessible = collection.accessible ?? published;
  const isAccessible = statusValue !== undefined && accessible.includes(statusValue);
  const isListed = statusValue !== undefined && published.includes(statusValue);
  return { accessible: isAccessible, listed: isListed };
}
