import { createHash } from "node:crypto";
import { CMSError } from "@notion-headless-cms/core";
import type { CollectionGenConfig } from "./index.js";
import type { DataSourceObjectResponse } from "./notion-client.js";

/** generate.ts → codegen.ts の中間表現。1 コレクション分の解決済みデータ。 */
export interface ResolvedCollection {
  name: string;
  config: CollectionGenConfig;
  id: string;
  dbName: string;
  properties: DataSourceObjectResponse["properties"];
}

/** Notion のプロパティ型 → PropertyDef の type 値マップ。 */
const NOTION_TYPE_MAP: Record<string, string | undefined> = {
  title: "title",
  rich_text: "richText",
  select: "select",
  status: "status",
  multi_select: "multiSelect",
  date: "date",
  number: "number",
  checkbox: "checkbox",
  url: "url",
};

/** Notion プロパティ名 → TypeScript camelCase 識別子。 */
function toTsCamelCase(name: string): string | null {
  const normalized = name
    .replace(/[\s-]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9_]/g, "");
  if (!normalized) return null;
  return normalized.charAt(0).toLowerCase() + normalized.slice(1);
}

/** PascalCase 化 (posts → Posts)。 */
function pascal(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** PropertyDef の type 値 → TS 型表現。 */
function tsTypeForPropDef(defType: string): string {
  switch (defType) {
    case "title":
    case "richText":
    case "url":
    case "select":
    case "status":
      return "string | null";
    case "multiSelect":
      return "string[]";
    case "date":
      return "string | null";
    case "number":
      return "number | null";
    case "checkbox":
      return "boolean";
    default:
      return "unknown";
  }
}

/**
 * Notion プロパティから status の literal union を抽出する (取得できない場合は null)。
 * Notion の status 型（ワークフロー状態）のみ literal union を生成する。
 * select 型はユーザーが自由に選択肢を追加できるため string | null のままにする。
 */
function extractSelectLiterals(
  prop: DataSourceObjectResponse["properties"][string],
): string[] | null {
  if (prop.type === "status" && Array.isArray(prop.status.options)) {
    return prop.status.options.map((o) => o.name);
  }
  return null;
}

interface ResolvedField {
  tsName: string;
  notionName: string;
  defType: string;
  tsType: string;
  literals: string[] | null;
}

/** プロパティを解決して TS フィールド情報の配列に変換する。 */
function resolveFields(collection: ResolvedCollection): {
  fields: ResolvedField[];
  skippedComments: string[];
} {
  const { name, config, dbName, properties } = collection;
  const fieldMappings = config.fieldMappings ?? {};

  for (const notionPropName of Object.keys(fieldMappings)) {
    if (!(notionPropName in properties)) {
      throw new CMSError({
        code: "cli/schema_invalid",
        message: `[${name}] fieldMappings に "${notionPropName}" が指定されていますが、DB "${dbName}" に該当するプロパティが見つかりません。`,
        context: { operation: "resolveFields", collection: name, dbName },
      });
    }
  }

  const fields: ResolvedField[] = [];
  const skippedComments: string[] = [];
  const usedNames = new Set<string>();

  for (const [notionPropName, prop] of Object.entries(properties)) {
    const defType = NOTION_TYPE_MAP[prop.type];
    if (!defType) {
      skippedComments.push(
        `// スキップ: ${notionPropName} (未対応のプロパティ型: ${prop.type})`,
      );
      continue;
    }

    let tsName = fieldMappings[notionPropName] ?? toTsCamelCase(notionPropName);
    if (tsName === null) {
      throw new CMSError({
        code: "cli/schema_invalid",
        message:
          `[${name}] プロパティ "${notionPropName}" は TypeScript 識別子に自動変換できません。` +
          ` fieldMappings で明示マッピングを指定してください: { "${notionPropName}": "fieldName" }`,
        context: {
          operation: "resolveFields",
          collection: name,
          notionPropName,
        },
      });
    }

    if (usedNames.has(tsName)) {
      let candidate: string;
      let suffix = 2;
      do {
        candidate = `${tsName}_${suffix++}`;
      } while (usedNames.has(candidate));
      tsName = candidate;
    }
    usedNames.add(tsName);

    const literals = extractSelectLiterals(prop);
    const tsType =
      literals && literals.length > 0
        ? `${literals.map((l) => JSON.stringify(l)).join(" | ")} | null`
        : tsTypeForPropDef(defType);

    fields.push({
      tsName,
      notionName: notionPropName,
      defType,
      tsType,
      literals,
    });
  }

  return { fields, skippedComments };
}

/** 1 コレクション分のコードブロック (型定義 + properties 定数 + DB ID)。 */
function generateCollectionBlock(
  collection: ResolvedCollection,
  resolved: { fields: ResolvedField[]; skippedComments: string[] },
): string {
  const { name, id, dbName, config } = collection;
  const itemTypeName = pascal(name).replace(/s$/, ""); // posts → Post
  const isData = config.kind === "data";
  // 要素コレクション（kind: "data"）は URL を持たないため slug を解決・生成しない。
  const slugField = isData ? undefined : (config.slugField ?? "slug");
  const statusField = config.statusField ?? "status";

  const propertyLines = resolved.fields.map((f) => {
    const escaped = f.notionName.replace(/"/g, '\\"');
    const optionsPart =
      f.defType === "status" && f.literals && f.literals.length > 0
        ? `, options: [${f.literals.map((l) => JSON.stringify(l)).join(", ")}] as const`
        : "";
    return `\t${f.tsName}: { type: "${f.defType}" as const, notion: "${escaped}"${optionsPart} },`;
  });

  const itemFieldLines: string[] = [
    "\t/** Notion ページ ID。 */",
    "\tid: string;",
    "\t/** Notion ページの最終編集時刻 (ISO8601)。 */",
    "\tlastEditedTime: string;",
    "\t/** ページ作成日時 (ISO8601)。 */",
    "\tcreatedAt?: string;",
    "\t/** アーカイブ済み / ゴミ箱に入っている場合 true。core の list() から自動除外される。 */",
    "\tisArchived?: boolean;",
    "\t/** ゴミ箱に入っている場合 true。core の list() から自動除外される。 */",
    "\tisInTrash?: boolean;",
    "\t/** カバー画像 URL。未設定の場合は null。 */",
    "\tcoverImageUrl?: string | null;",
    "\t/** 絵文字アイコン。絵文字以外 / 未設定の場合は null。 */",
    "\ticonEmoji?: string | null;",
  ];
  let hasSlug = false;
  let hasStatus = false;
  let hasTitle = false;
  let hasPublishedAt = false;
  for (const f of resolved.fields) {
    if (f.tsName === slugField) hasSlug = true;
    if (f.tsName === statusField) hasStatus = true;
    if (f.tsName === "title") hasTitle = true;
    if (f.tsName === "publishedAt") hasPublishedAt = true;
    // slugField は null 非許容。slug なしのアイテムは CMS からアクセスされないため string で十分。
    const fieldType = f.tsName === slugField ? "string" : f.tsType;
    itemFieldLines.push(
      `\t/** Notion property: "${f.notionName.replace(/\*\//g, "*\\/")}" */`,
      `\t${f.tsName}: ${fieldType};`,
    );
  }
  if (!isData && !hasSlug) {
    itemFieldLines.push("\t/** URL key。 */", "\tslug: string;");
  }
  if (!hasStatus) {
    // BaseContentItem.status が string | null なので null を許容する
    itemFieldLines.push("\t/** ステータス。 */", "\tstatus?: string | null;");
  }
  if (!hasTitle) {
    itemFieldLines.push(
      "\t/** Notion ページタイトル。 */",
      "\ttitle?: string | null;",
    );
  }
  if (!hasPublishedAt) {
    // BaseContentItem.publishedAt が string | null なので null を許容する
    itemFieldLines.push(
      "\t/** 公開日時 (ISO8601)。 */",
      "\tpublishedAt?: string | null;",
    );
  }

  const separator = "// =".padEnd(62, "=");
  const lines: string[] = [
    separator,
    `// ${name}  (${dbName})`,
    `// Notion DB ID: ${id}`,
    separator,
    "",
    `export const ${name}DataSourceId = "${id}";`,
    "",
    `/** Notion DB "${dbName.replace(/\*\//g, "*\\/")}" のプロパティマップ。 */`,
    `export const ${name}Properties = {`,
    ...propertyLines,
    `} as const satisfies PropertyMap;`,
    "",
    `/** ${name} コレクションの 1 アイテム型。 */`,
    `export interface ${itemTypeName} {`,
    ...itemFieldLines,
    `}`,
  ];

  if (resolved.skippedComments.length > 0) {
    lines.push("", ...resolved.skippedComments);
  }

  return lines.join("\n");
}

/** schema 集約ブロックを生成する。`notionSource()` が消費する。 */
function generateSchemaAggregateBlock(
  collections: ResolvedCollection[],
): string {
  const entries = collections.map((c) => {
    const statusField = c.config.statusField ?? "status";
    if (c.config.kind === "data") {
      // 要素コレクション: slug を持たないため slugField を出力しない。
      return `\t${c.name}: {
\t\tkind: "data",
\t\tdataSourceId: ${c.name}DataSourceId,
\t\tproperties: ${c.name}Properties,
\t\tstatusField: ${JSON.stringify(statusField)},
\t},`;
    }
    const slugField = c.config.slugField ?? "slug";
    return `\t${c.name}: {
\t\tdataSourceId: ${c.name}DataSourceId,
\t\tproperties: ${c.name}Properties,
\t\tslugField: ${JSON.stringify(slugField)},
\t\tstatusField: ${JSON.stringify(statusField)},
\t},`;
  });

  return `// =${"=".repeat(60)}
// Schema 集約 (notionSource() に渡す)
// =${"=".repeat(60)}

/** 全コレクションのスキーマ集約。\`notionSource({ schema })\` に渡す。 */
export const schema = {
${entries.join("\n")}
} as const satisfies SchemaMap;
`;
}

/** nhc.schema.ts 全体のコードを生成する。 */
export function generateSchemaFile(collections: ResolvedCollection[]): string {
  const sha = createHash("sha256")
    .update(JSON.stringify(collections))
    .digest("hex");

  const header = [
    "// このファイルは nhc generate により自動生成されました。手動編集は nhc generate で上書きされます。",
    `// Config SHA: ${sha}`,
    "",
    'import type { PropertyMap } from "@notion-headless-cms/core";',
    'import type { SchemaMap } from "@notion-headless-cms/notion-source";',
  ].join("\n");

  const blocks = collections.map((c) =>
    generateCollectionBlock(c, resolveFields(c)),
  );

  const aggregate = generateSchemaAggregateBlock(collections);

  // タブをスペースに変換し、末尾の余分な改行を正規化して Biome の lint を通す
  const raw = [header, ...blocks, aggregate].join("\n\n").replace(/\t/g, "  ");
  return `${raw.trimEnd()}\n`;
}
