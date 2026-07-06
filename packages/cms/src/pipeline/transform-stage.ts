import type { NormalizedBlock } from "../types/entry-snapshot.js";

/**
 * 事前レンダー拡張の契約(shiki のシンタックスハイライト・katex の数式組版等)。
 * 実 I/O を伴う取得(OGP fetch 等)は「取得すべき URL リスト」を返す形にし、
 * 変換本体の純関数性を保つ(実 fetch は同期エンジン側の責務)。
 */
export interface TransformStage {
  readonly name: string;
  /** blocks を受け取り、事前レンダー結果を焼き込んだ blocks を返す。 */
  transform(blocks: readonly NormalizedBlock[]): Promise<readonly NormalizedBlock[]>;
  /** このステージが I/O を必要とする場合、事前に取得すべき URL 一覧を返す。 */
  collectFetchTargets?(blocks: readonly NormalizedBlock[]): readonly string[];
}

/** 複数の TransformStage を順番に適用する。 */
export async function runTransformStages(
  blocks: readonly NormalizedBlock[],
  stages: readonly TransformStage[],
): Promise<readonly NormalizedBlock[]> {
  let current = blocks;
  for (const stage of stages) {
    current = await stage.transform(current);
  }
  return current;
}
