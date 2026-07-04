import type { JsonValue } from "../types/json-value.js";

/**
 * `JsonValue` 同士の構造的な等価性を判定する。オブジェクトのキー順序には依存しない
 * （`JSON.stringify` の単純比較だとキー順序の違いで誤って不一致になるため）。
 */
export function deepEqualJson(a: JsonValue, b: JsonValue): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((value, i) => deepEqualJson(value, b[i] as JsonValue));
  }
  if (
    typeof a === "object" &&
    a !== null &&
    typeof b === "object" &&
    b !== null
  ) {
    const aRecord = a as Record<string, JsonValue>;
    const bRecord = b as Record<string, JsonValue>;
    const aKeys = Object.keys(aRecord);
    const bKeys = Object.keys(bRecord);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(
      (key) =>
        key in bRecord &&
        deepEqualJson(aRecord[key] as JsonValue, bRecord[key] as JsonValue),
    );
  }
  return false;
}
