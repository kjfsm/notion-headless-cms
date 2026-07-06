import type { DataSourceObjectResponse } from "./notion-client.js";

type NotionProperty = DataSourceObjectResponse["properties"][string];

/** Notion プロパティ名 → TypeScript camelCase 識別子への基礎変換(衝突解決なし)。 */
function toBaseIdentifier(name: string): string {
  const normalized = name
    .replace(/[\s-]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9_]/g, "");
  if (!normalized) return "";
  const withLowerFirst =
    normalized.charAt(0).toLowerCase() + normalized.slice(1);
  return /^[0-9]/.test(withLowerFirst) ? `_${withLowerFirst}` : withLowerFirst;
}

/**
 * 正規化すると空文字列になる名前(日本語などの非 ASCII のみのプロパティ名)向けの
 * プロパティ種別ベースのフォールバック接頭辞。
 */
const FALLBACK_PREFIX: Record<string, string> = {
  title: "unnamedTitle",
  rich_text: "unnamedRichText",
  select: "unnamedSelect",
  status: "unnamedStatus",
  multi_select: "unnamedMultiSelect",
  date: "unnamedDate",
  number: "unnamedNumber",
  checkbox: "unnamedCheckbox",
  url: "unnamedUrl",
  formula: "unnamedFormula",
  rollup: "unnamedRollup",
  relation: "unnamedRelation",
  people: "unnamedPeople",
  files: "unnamedFiles",
  unique_id: "unnamedUniqueId",
  created_time: "unnamedCreatedTime",
  last_edited_by: "unnamedLastEditedBy",
};

export interface AssignedIdentifier {
  readonly identifier: string;
  /** 元の名前が非 ASCII のみ等で正規化結果が空になり、種別ベースのフォールバックを使ったか。 */
  readonly usedFallback: boolean;
}

/**
 * Notion data source の全プロパティ名を TS 識別子へ一括変換する。
 *
 * 日本語などの非 ASCII のみの名前は基礎変換すると空文字列になり、そのままでは
 * 複数プロパティが同じ識別子("unnamed" 固定)に衝突していた。プロパティ種別
 * ベースのフォールバック + 連番で衝突を避ける(`Object.entries` の列挙順は
 * 挿入順で安定するため、同一 data source に対しては決定的な結果になる)。
 */
export function assignIdentifiers(
  properties: DataSourceObjectResponse["properties"],
): Map<string, AssignedIdentifier> {
  const seenCount = new Map<string, number>();
  const result = new Map<string, AssignedIdentifier>();
  for (const [name, prop] of Object.entries(properties)) {
    const base = toBaseIdentifier(name);
    const usedFallback = base === "";
    const candidate = usedFallback
      ? (FALLBACK_PREFIX[(prop as NotionProperty).type] ?? "unnamed")
      : base;
    const count = seenCount.get(candidate) ?? 0;
    seenCount.set(candidate, count + 1);
    const identifier = count === 0 ? candidate : `${candidate}${count + 1}`;
    result.set(name, { identifier, usedFallback });
  }
  return result;
}
