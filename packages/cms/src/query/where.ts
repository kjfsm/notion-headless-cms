import type { JsonValue } from "../types/json-value.js";

type Operators = Record<string, JsonValue>;

function evaluateOperator(value: JsonValue | undefined, op: string, opValue: JsonValue): boolean {
  switch (op) {
    case "equals":
      return value === opValue;
    case "contains":
      return typeof value === "string" && typeof opValue === "string" && value.includes(opValue);
    case "startsWith":
      return typeof value === "string" && typeof opValue === "string" && value.startsWith(opValue);
    case "isEmpty":
      return opValue === true ? value == null || value === "" : value != null && value !== "";
    case "in":
      return Array.isArray(opValue) && opValue.includes(value as JsonValue);
    case "has":
      return Array.isArray(value) && value.includes(opValue);
    case "hasAny":
      return (
        Array.isArray(value) &&
        Array.isArray(opValue) &&
        opValue.some((v) => (value as JsonValue[]).includes(v))
      );
    case "hasAll":
      return (
        Array.isArray(value) &&
        Array.isArray(opValue) &&
        opValue.every((v) => (value as JsonValue[]).includes(v))
      );
    case "gt":
      return typeof value === "number" && typeof opValue === "number" && value > opValue;
    case "gte":
      return typeof value === "number" && typeof opValue === "number" && value >= opValue;
    case "lt":
      return typeof value === "number" && typeof opValue === "number" && value < opValue;
    case "lte":
      return typeof value === "number" && typeof opValue === "number" && value <= opValue;
    case "before":
      return typeof value === "string" && typeof opValue === "string" && value < opValue;
    case "after":
      return typeof value === "string" && typeof opValue === "string" && value > opValue;
    case "onOrBefore":
      return typeof value === "string" && typeof opValue === "string" && value <= opValue;
    case "onOrAfter":
      return typeof value === "string" && typeof opValue === "string" && value >= opValue;
    default:
      return true; // 未知の演算子キーは無視する(型で弾かれている前提)。
  }
}

/**
 * `WhereInput`(#438 で導出された型)をランタイムで評価する。
 * `meta` は `IndexEntry.meta` のようなプレーンな JSON レコード。
 */
export function evaluateWhere(
  meta: Record<string, JsonValue>,
  where: Record<string, Operators> | undefined,
): boolean {
  if (!where) return true;
  for (const [key, operators] of Object.entries(where)) {
    if (!operators) continue;
    const value = meta[key];
    for (const [op, opValue] of Object.entries(operators)) {
      if (!evaluateOperator(value, op, opValue)) return false;
    }
  }
  return true;
}

export interface RuntimeSortInput {
  readonly by: string;
  readonly direction: "asc" | "desc";
}

function compareValues(a: JsonValue | undefined, b: JsonValue | undefined): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
  return 0;
}

/** `sort` 指定(複数キー対応)でエントリを並べ替える。破壊的でない(新しい配列を返す)。 */
export function sortByMeta<T>(
  items: readonly T[],
  sort: readonly RuntimeSortInput[] | undefined,
  getMeta: (item: T) => Record<string, JsonValue>,
): T[] {
  if (!sort || sort.length === 0) return [...items];
  return [...items].sort((a, b) => {
    for (const s of sort) {
      const cmp = compareValues(getMeta(a)[s.by], getMeta(b)[s.by]);
      if (cmp !== 0) return s.direction === "asc" ? cmp : -cmp;
    }
    return 0;
  });
}
