import type { PropertyMap } from "@notion-headless-cms/cms";

import { assignIdentifiers } from "./identifier.js";
import type { DataSourceObjectResponse } from "./notion-client.js";

const NOTION_TYPE_FOR_KIND: Record<string, string> = {
  title: "title",
  richText: "rich_text",
  select: "select",
  status: "status",
  multiSelect: "multi_select",
  date: "date",
  number: "number",
  checkbox: "checkbox",
  url: "url",
  formula: "formula",
  rollup: "rollup",
  relation: "relation",
  people: "people",
  files: "files",
  uniqueId: "unique_id",
  createdTime: "created_time",
  lastEditedBy: "last_edited_by",
};

export type DriftKind = "added" | "removed" | "type_changed" | "options_changed";

export interface PropertyDrift {
  readonly key: string;
  readonly kind: DriftKind;
  readonly detail: string;
}

export interface SchemaDrift {
  readonly hasDrift: boolean;
  readonly changes: readonly PropertyDrift[];
}

function optionNames(options: readonly { name: string }[]): string[] {
  return options.map((o) => o.name).sort(compareStrings);
}

// options は generic bound の readonly string[] で渡ってくるため、型チェッカーが
// 要素型を string と断定できず sort() の compare 引数省略が警告される。既定の
// 文字列比較(UTF-16 code unit 順)と同じ挙動の compare を明示して警告を解消する。
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * TS スキーマ定義(`properties`)と実 Notion DB の drift を検証する(`nhc check`)。
 * プロパティ追加・削除・型変更・status/select/multiSelect の options 変更を検出する。
 * `fieldMappings` はスキーマ側で使っている明示的な別名。指定が無いプロパティは
 * `assignIdentifiers()` の自動変換にフォールバックする(`nhc pull` と同じ解決順)。
 */
export function diffSchema(
  dataSource: DataSourceObjectResponse,
  properties: PropertyMap,
  fieldMappings: Record<string, string> = {},
): SchemaDrift {
  const changes: PropertyDrift[] = [];
  const seenKeys = new Set<string>();
  const identifiers = assignIdentifiers(dataSource.properties);

  for (const [name, notionProp] of Object.entries(dataSource.properties)) {
    const key = fieldMappings[name] ?? identifiers.get(name)?.identifier ?? name;
    const expected = properties[key];
    if (!expected) {
      changes.push({
        key,
        kind: "added",
        detail: `Notion 側に新しいプロパティ "${name}" があります(スキーマ未定義)`,
      });
      continue;
    }
    seenKeys.add(key);

    const expectedNotionType = NOTION_TYPE_FOR_KIND[expected.kind];
    if (expectedNotionType && expectedNotionType !== notionProp.type) {
      changes.push({
        key,
        kind: "type_changed",
        detail: `型が ${expected.kind}(Notion 側 "${expectedNotionType}" 想定)から "${notionProp.type}" に変わっています`,
      });
      continue;
    }

    if (expected.kind === "status" && notionProp.type === "status") {
      const live = optionNames(notionProp.status.options);
      const declared = [...(expected.options ?? [])].sort(compareStrings);
      if (JSON.stringify(live) !== JSON.stringify(declared)) {
        changes.push({
          key,
          kind: "options_changed",
          detail: `status の選択肢が変わっています(現在: ${live.join(", ")})`,
        });
      }
    } else if (expected.kind === "select" && notionProp.type === "select") {
      const live = optionNames(notionProp.select.options);
      const declared = [...(expected.options ?? [])].sort(compareStrings);
      if (declared.length > 0 && JSON.stringify(live) !== JSON.stringify(declared)) {
        changes.push({
          key,
          kind: "options_changed",
          detail: `select の選択肢が変わっています(現在: ${live.join(", ")})`,
        });
      }
    } else if (expected.kind === "multiSelect" && notionProp.type === "multi_select") {
      const live = optionNames(notionProp.multi_select.options);
      const declared = [...(expected.options ?? [])].sort(compareStrings);
      if (declared.length > 0 && JSON.stringify(live) !== JSON.stringify(declared)) {
        changes.push({
          key,
          kind: "options_changed",
          detail: `multi_select の選択肢が変わっています(現在: ${live.join(", ")})`,
        });
      }
    }
  }

  for (const key of Object.keys(properties)) {
    if (!seenKeys.has(key)) {
      changes.push({
        key,
        kind: "removed",
        detail: `コードに定義されているプロパティ "${key}" が Notion 側に見つかりません`,
      });
    }
  }

  return { hasDrift: changes.length > 0, changes };
}
