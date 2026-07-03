import type { PropertyMap } from "@notion-headless-cms/cms";
import type { DataSourceObjectResponse } from "../notion-client.js";
import { assignIdentifiers } from "./identifier.js";

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

export type DriftKind =
  | "added"
  | "removed"
  | "type_changed"
  | "options_changed";

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
  return [...options.map((o) => o.name)].sort();
}

/**
 * TS スキーマ定義(`properties`)と実 Notion DB の drift を検証する(`nhc check`)。
 * プロパティ追加・削除・型変更・status/select/multiSelect の options 変更を検出する。
 */
export function diffSchema(
  dataSource: DataSourceObjectResponse,
  properties: PropertyMap,
): SchemaDrift {
  const changes: PropertyDrift[] = [];
  const seenKeys = new Set<string>();
  const identifiers = assignIdentifiers(dataSource.properties);

  for (const [name, notionProp] of Object.entries(dataSource.properties)) {
    const key = identifiers.get(name)?.identifier ?? name;
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
      const declared = [...(expected.options ?? [])].sort();
      if (JSON.stringify(live) !== JSON.stringify(declared)) {
        changes.push({
          key,
          kind: "options_changed",
          detail: `status の選択肢が変わっています(現在: ${live.join(", ")})`,
        });
      }
    } else if (expected.kind === "select" && notionProp.type === "select") {
      const live = optionNames(notionProp.select.options);
      const declared = [...(expected.options ?? [])].sort();
      if (
        declared.length > 0 &&
        JSON.stringify(live) !== JSON.stringify(declared)
      ) {
        changes.push({
          key,
          kind: "options_changed",
          detail: `select の選択肢が変わっています(現在: ${live.join(", ")})`,
        });
      }
    } else if (
      expected.kind === "multiSelect" &&
      notionProp.type === "multi_select"
    ) {
      const live = optionNames(notionProp.multi_select.options);
      const declared = [...(expected.options ?? [])].sort();
      if (
        declared.length > 0 &&
        JSON.stringify(live) !== JSON.stringify(declared)
      ) {
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
