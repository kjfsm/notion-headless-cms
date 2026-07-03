import type { NormalizedBlock } from "../types/entry-snapshot.js";
import type { JsonValue } from "../types/json-value.js";

/** JSON オブジェクト（配列・プリミティブを除く）かどうかの判定。 */
export function isJsonRecord(
  value: JsonValue | undefined,
): value is { readonly [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * ブロックツリーを非破壊に変換する（TransformStage 実装の共通ヘルパー）。
 * `visit` が返したブロックの children を再帰処理する。変更が無い部分は
 * 元の参照をそのまま返す（無変更ツリーの再構築を避ける）。
 */
export async function mapBlocks(
  blocks: readonly NormalizedBlock[],
  visit: (block: NormalizedBlock) => Promise<NormalizedBlock>,
): Promise<readonly NormalizedBlock[]> {
  let changed = false;
  const next = await Promise.all(
    blocks.map(async (block) => {
      let result = await visit(block);
      if (result.children?.length) {
        const children = await mapBlocks(result.children, visit);
        if (children !== result.children) {
          result = { ...result, children };
        }
      }
      if (result !== block) changed = true;
      return result;
    }),
  );
  return changed ? next : blocks;
}

/**
 * `NormalizedBlock.data` のような JSON 値を深さ優先で走査し、オブジェクトごとに
 * `visit` を適用した新しい値を返す（非破壊）。rich_text 配列は `data.rich_text` 直下
 * だけでなく caption・table_row の cells 等の深部にも現れるため、キーを決め打ちせず
 * 全オブジェクトを訪問する。
 *
 * - `visit` が置換オブジェクトを返した場合、その内部には再帰しない
 *   （二重適用を防ぐ。置換結果に更なる訪問対象が無い前提で使うこと）
 * - 変更が無い部分は元の参照をそのまま返す
 */
export async function mapJsonObjects(
  value: JsonValue,
  visit: (obj: {
    readonly [key: string]: JsonValue;
  }) => Promise<{ readonly [key: string]: JsonValue } | null>,
): Promise<JsonValue> {
  if (Array.isArray(value)) {
    let changed = false;
    const next = await Promise.all(
      value.map(async (item) => {
        const result = await mapJsonObjects(item, visit);
        if (result !== item) changed = true;
        return result;
      }),
    );
    return changed ? next : value;
  }
  if (isJsonRecord(value)) {
    const replaced = await visit(value);
    if (replaced !== null) return replaced;
    let changed = false;
    const entries = await Promise.all(
      Object.entries(value).map(async ([key, child]) => {
        const result = await mapJsonObjects(child, visit);
        if (result !== child) changed = true;
        return [key, result] as const;
      }),
    );
    return changed ? Object.fromEntries(entries) : value;
  }
  return value;
}
