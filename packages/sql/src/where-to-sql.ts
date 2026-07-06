import type { JsonValue, RuntimeSortInput } from "@notion-headless-cms/cms";
import type { SelectQueryBuilder } from "kysely";
import { sql } from "kysely";

import type { QueryableColumn } from "./schema.js";

// biome-ignore lint/suspicious/noExplicitAny: コレクションごとに動的な列集合を持つため、Kysely の静的 Database 型に対して型消去する（create-cms.ts の型消去パターンと同じ意図）。
type AnyQB = SelectQueryBuilder<any, any, any>;

function toSqlValue(column: QueryableColumn, value: JsonValue): unknown {
  if (column.type === "integer" && typeof value === "boolean") return value ? 1 : 0;
  return value;
}

/** `?` 由来の LIKE ワイルドカード(`%`/`_`)をエスケープする。 */
function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, (c) => `\\${c}`);
}

function hasCondition(qb: AnyQB, column: string, value: JsonValue): AnyQB {
  return qb.where(
    sql<boolean>`EXISTS (SELECT 1 FROM json_each(${sql.ref(column)}) WHERE json_each.value = ${value})`,
  );
}

function applyOperator(qb: AnyQB, column: QueryableColumn, op: string, value: JsonValue): AnyQB {
  const col = column.column;
  switch (op) {
    case "equals":
      return qb.where(col, "=", toSqlValue(column, value));
    case "contains":
      return typeof value === "string" ? qb.where(col, "like", `%${escapeLike(value)}%`) : qb;
    case "startsWith":
      return typeof value === "string" ? qb.where(col, "like", `${escapeLike(value)}%`) : qb;
    case "isEmpty":
      return value === true
        ? qb.where((eb) => eb.or([eb(col, "is", null), eb(col, "=", "")]))
        : qb.where((eb) => eb.and([eb(col, "is not", null), eb(col, "!=", "")]));
    case "in":
      return Array.isArray(value) ? qb.where(col, "in", value) : qb;
    case "has":
      return hasCondition(qb, col, value);
    case "hasAny":
      if (!Array.isArray(value) || value.length === 0) return qb;
      return qb.where((eb) =>
        eb.or(
          value.map(
            (v) =>
              sql<boolean>`EXISTS (SELECT 1 FROM json_each(${sql.ref(col)}) WHERE json_each.value = ${v})`,
          ),
        ),
      );
    case "hasAll":
      if (!Array.isArray(value) || value.length === 0) return qb;
      return qb.where((eb) =>
        eb.and(
          value.map(
            (v) =>
              sql<boolean>`EXISTS (SELECT 1 FROM json_each(${sql.ref(col)}) WHERE json_each.value = ${v})`,
          ),
        ),
      );
    case "gt":
      return qb.where(col, ">", value);
    case "gte":
      return qb.where(col, ">=", value);
    case "lt":
      return qb.where(col, "<", value);
    case "lte":
      return qb.where(col, "<=", value);
    // date は ISO 8601 文字列として保存するため、文字列比較が時系列順と一致する。
    case "before":
      return qb.where(col, "<", value);
    case "after":
      return qb.where(col, ">", value);
    case "onOrBefore":
      return qb.where(col, "<=", value);
    case "onOrAfter":
      return qb.where(col, ">=", value);
    default:
      return qb; // 未知の演算子キーは無視する(型で弾かれている前提。query/where.ts と同じ方針)。
  }
}

/**
 * `ListRuntimeParams.where` を `columns`(コレクションの実カラム一覧)を使って WHERE 句へ変換する。
 * `where` のキーに対応する実カラムが無い(= where 演算子を持たないプロパティ、`schema.ts` の
 * `columnTypeFor` 参照)場合はそのキーを無視する。
 */
export function applyWhere(
  qb: AnyQB,
  columns: readonly QueryableColumn[],
  where: Record<string, Record<string, JsonValue>> | undefined,
): AnyQB {
  if (!where) return qb;
  const byKey = new Map(columns.map((c) => [c.propKey, c] as const));
  let result = qb;
  for (const [propKey, operators] of Object.entries(where)) {
    const column = byKey.get(propKey);
    if (!column || !operators) continue;
    for (const [op, value] of Object.entries(operators)) {
      result = applyOperator(result, column, op, value);
    }
  }
  return result;
}

/** `ListRuntimeParams.sort` を ORDER BY へ変換する。実カラムが無いキーは無視する。 */
export function applySort(
  qb: AnyQB,
  columns: readonly QueryableColumn[],
  sortInputs: readonly RuntimeSortInput[] | undefined,
): AnyQB {
  if (!sortInputs || sortInputs.length === 0) return qb;
  const byKey = new Map(columns.map((c) => [c.propKey, c] as const));
  let result = qb;
  for (const s of sortInputs) {
    const column = byKey.get(s.by);
    if (!column) continue;
    result = result.orderBy(column.column, s.direction);
  }
  return result;
}
