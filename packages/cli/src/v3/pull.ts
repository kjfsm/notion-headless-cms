import type { DataSourceObjectResponse } from "../notion-client.js";

/** Notion プロパティ名 → TypeScript camelCase 識別子。 */
function toTsIdentifier(name: string): string {
  const normalized = name
    .replace(/[\s-]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9_]/g, "");
  if (!normalized) return "unnamed";
  const withLowerFirst =
    normalized.charAt(0).toLowerCase() + normalized.slice(1);
  return /^[0-9]/.test(withLowerFirst) ? `_${withLowerFirst}` : withLowerFirst;
}

type NotionProperty = DataSourceObjectResponse["properties"][string];

function optionsLiteral(options: readonly { name: string }[]): string {
  return `[${options.map((o) => JSON.stringify(o.name)).join(", ")}] as const`;
}

/**
 * 1 プロパティ分の `prop.*()` 呼び出しを生成する。formula/rollup は結果型が
 * スキーマからは判定できないため `string` を仮置きし、確認を促すコメントを添える。
 */
function propCallFor(prop: NotionProperty): { call: string; comment?: string } {
  switch (prop.type) {
    case "title":
      return { call: "prop.title()" };
    case "rich_text":
      return { call: "prop.richText()" };
    case "select":
      return { call: `prop.select(${optionsLiteral(prop.select.options)})` };
    case "status":
      return { call: `prop.status(${optionsLiteral(prop.status.options)})` };
    case "multi_select":
      return {
        call: `prop.multiSelect(${optionsLiteral(prop.multi_select.options)})`,
      };
    case "date":
      return { call: "prop.date()" };
    case "number":
      return { call: "prop.number()" };
    case "checkbox":
      return { call: "prop.checkbox()" };
    case "url":
      return { call: "prop.url()" };
    case "formula":
      return {
        call: 'prop.formula("string")',
        comment:
          "formula の結果型はスキーマから判定できません。実際の型(string/number/boolean/date)を確認してください",
      };
    case "rollup":
      return {
        call: 'prop.rollup("string")',
        comment:
          "rollup の結果型はスキーマから判定できません。実際の型(string/number/boolean/date/array)を確認してください",
      };
    case "relation":
      return { call: "prop.relation()" };
    case "people":
      return { call: "prop.people()" };
    case "files":
      return { call: "prop.files()" };
    case "unique_id":
      return { call: "prop.uniqueId()" };
    case "created_time":
      return { call: "prop.createdTime()" };
    case "last_edited_by":
      return { call: "prop.lastEditedBy()" };
    default:
      return {
        call: "",
        comment: `未対応のプロパティ型 "${prop.type}" です。手動で対応を検討してください`,
      };
  }
}

export interface PullOptions {
  readonly collectionName: string;
  readonly dataSourceId: string;
}

/**
 * Notion data source のスキーマから `defineCollection` の雛形 TS コードを生成する
 * (`nhc pull`)。既存ファイルは上書きしない — 生成物の所有権はユーザーに移る
 * (v2 の「生成物コミット + 手編集禁止」運用を廃止)。
 */
export function generateCollectionScaffold(
  dataSource: DataSourceObjectResponse,
  opts: PullOptions,
): string {
  const lines: string[] = [];
  const titleKey = Object.entries(dataSource.properties).find(
    ([, p]) => p.type === "title",
  )?.[0];

  for (const [name, prop] of Object.entries(dataSource.properties)) {
    const identifier = toTsIdentifier(name);
    const { call, comment } = propCallFor(prop);
    if (!call) {
      lines.push(`  // ${identifier}: ${comment}`);
      continue;
    }
    if (comment) lines.push(`  // ${identifier}: ${comment}`);
    lines.push(`  ${identifier}: ${call},`);
  }

  const slugKey = titleKey ? toTsIdentifier(titleKey) : "title";

  return `import { defineCollection, prop } from "@notion-headless-cms/cms";

export const ${opts.collectionName} = defineCollection({
  dataSourceId: ${JSON.stringify(opts.dataSourceId)},
  slug: ${JSON.stringify(slugKey)},
  properties: {
${lines.join("\n")}
  },
});
`;
}
