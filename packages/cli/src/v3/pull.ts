import type { DataSourceObjectResponse } from "../notion-client.js";
import { assignIdentifiers } from "./identifier.js";

type NotionProperty = DataSourceObjectResponse["properties"][string];

function optionsLiteral(options: readonly { name: string }[]): string {
  return `[${options.map((o) => JSON.stringify(o.name)).join(", ")}] as const`;
}

/**
 * 1 プロパティ分の `prop.*()` 呼び出しを生成する。formula/rollup は結果型が
 * スキーマからは判定できないため `string` を仮置きし、確認を促すコメントを添える。
 *
 * `aliasName` はスキーマの識別子(キー)と実際の Notion プロパティ名が異なる場合に
 * `prop.*()` の末尾引数として渡す実名（`packages/cms` の `notion?: string`）。
 * 一致する場合は省略し、生成コードを簡潔に保つ。
 */
function propCallFor(
  prop: NotionProperty,
  aliasName: string | undefined,
): { call: string; comment?: string } {
  const alias = aliasName !== undefined ? JSON.stringify(aliasName) : undefined;
  switch (prop.type) {
    case "title":
      return { call: `prop.title(${alias ?? ""})` };
    case "rich_text":
      return { call: `prop.richText(${alias ?? ""})` };
    case "select": {
      const args = [optionsLiteral(prop.select.options), alias]
        .filter((a): a is string => a !== undefined)
        .join(", ");
      return { call: `prop.select(${args})` };
    }
    case "status": {
      const args = [optionsLiteral(prop.status.options), alias]
        .filter((a): a is string => a !== undefined)
        .join(", ");
      return { call: `prop.status(${args})` };
    }
    case "multi_select": {
      const args = [optionsLiteral(prop.multi_select.options), alias]
        .filter((a): a is string => a !== undefined)
        .join(", ");
      return { call: `prop.multiSelect(${args})` };
    }
    case "date":
      return { call: `prop.date(${alias ?? ""})` };
    case "number":
      return { call: `prop.number(${alias ?? ""})` };
    case "checkbox":
      return { call: `prop.checkbox(${alias ?? ""})` };
    case "url":
      return { call: `prop.url(${alias ?? ""})` };
    case "formula":
      return {
        call: `prop.formula(${['"string"', alias].filter((a): a is string => a !== undefined).join(", ")})`,
        comment:
          "formula の結果型はスキーマから判定できません。実際の型(string/number/boolean/date)を確認してください",
      };
    case "rollup":
      return {
        call: `prop.rollup(${['"string"', alias].filter((a): a is string => a !== undefined).join(", ")})`,
        comment:
          "rollup の結果型はスキーマから判定できません。実際の型(string/number/boolean/date/array)を確認してください",
      };
    case "relation":
      // 第 1 引数は targetCollection。alias 指定時は明示的に undefined を渡して埋める。
      return {
        call: `prop.relation(${alias !== undefined ? `undefined, ${alias}` : ""})`,
      };
    case "people":
      return { call: `prop.people(${alias ?? ""})` };
    case "files":
      return { call: `prop.files(${alias ?? ""})` };
    case "unique_id":
      return { call: `prop.uniqueId(${alias ?? ""})` };
    case "created_time":
      return { call: `prop.createdTime(${alias ?? ""})` };
    case "last_edited_by":
      return { call: `prop.lastEditedBy(${alias ?? ""})` };
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
  /**
   * Notion プロパティ名 → TypeScript フィールド名の明示マッピング。
   * 指定が無いプロパティは `assignIdentifiers()` の自動変換にフォールバックする。
   */
  readonly fieldMappings?: Record<string, string>;
}

/**
 * Notion data source のスキーマから `defineCollection` の雛形 TS コードを生成する
 * (`nhc pull`)。既存ファイルは上書きしない — 生成物の所有権はユーザーに移る
 * (v2 の「生成物コミット + 手編集禁止」運用を廃止)。
 *
 * スキーマキー(識別子)が実際の Notion プロパティ名と異なる場合は、`prop.*()` に
 * 実名を渡して `packages/cms` 側の別名解決（`mapProperties()`）で正しく読めるようにする。
 */
export function generateCollectionScaffold(
  dataSource: DataSourceObjectResponse,
  opts: PullOptions,
): string {
  const lines: string[] = [];
  const fieldMappings = opts.fieldMappings ?? {};
  const identifiers = assignIdentifiers(dataSource.properties);
  let titleIdentifier: string | undefined;

  for (const [name, prop] of Object.entries(dataSource.properties)) {
    const identifier = fieldMappings[name] ?? identifiers.get(name)?.identifier;
    if (!identifier) continue;
    if (prop.type === "title") titleIdentifier = identifier;

    const needsAlias = identifier !== name;
    const { call, comment } = propCallFor(prop, needsAlias ? name : undefined);
    if (needsAlias) {
      lines.push(`  /** 元のプロパティ名: ${JSON.stringify(name)} */`);
    }
    if (!call) {
      lines.push(`  // ${identifier}: ${comment}`);
      continue;
    }
    if (comment) lines.push(`  // ${identifier}: ${comment}`);
    lines.push(`  ${identifier}: ${call},`);
  }

  const slugKey = titleIdentifier || "title";

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
