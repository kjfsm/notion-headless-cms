import { CMSError } from "@notion-headless-cms/core";
import type { DataSourceConfig } from "./index.js";
import type { DataSourceObjectResponse } from "./notion-client.js";

interface ResolvedSource {
	config: DataSourceConfig;
	id: string;
	dbName: string;
	properties: DataSourceObjectResponse["properties"];
}

/**
 * サポートする Notion プロパティ型 → PropertyDef の type 値マップ。
 * この型リスト以外のプロパティはスキップしてコメントとして出力する。
 */
const NOTION_TYPE_TO_PROPERTY_DEF_TYPE: Record<string, string | undefined> = {
	title: "title",
	rich_text: "richText",
	select: "select",
	status: "select",
	multi_select: "multiSelect",
	date: "date",
	number: "number",
	checkbox: "checkbox",
	url: "url",
};

/** Notion プロパティ名を TypeScript の camelCase 識別子に変換する。 */
function toTsCamelCase(name: string): string | null {
	const normalized = name
		.replace(/[\s-]+(.)/g, (_, c: string) => c.toUpperCase())
		.replace(/[^a-zA-Z0-9_]/g, "");

	if (!normalized) return null;

	return normalized.charAt(0).toLowerCase() + normalized.slice(1);
}

/** 名前の先頭を大文字に（例: posts → Posts） */
function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

/** DB ソース1件分の TypeScript コードブロックを生成する。 */
function generateSourceBlock(
	source: ResolvedSource,
	warn?: (msg: string) => void,
): string {
	const { config, id, dbName, properties } = source;
	const varPrefix = config.name;
	const columnMappings = config.columnMappings ?? {};

	// ── 事前検証: columnMappings で指定したプロパティが DB に存在するか ──────
	const hint = `nhc.config.ts の "${config.name}" の columnMappings を確認してください。`;
	for (const notionPropName of Object.keys(columnMappings)) {
		if (!(notionPropName in properties)) {
			throw new CMSError({
				code: "cli/schema_invalid",
				message: `[${config.name}] columnMappings に "${notionPropName}" が指定されていますが、DB "${dbName}" に該当するプロパティが見つかりません。${hint}`,
				context: {
					operation: "generateSourceBlock",
					collection: config.name,
					dbName,
				},
			});
		}
	}

	// ── 全プロパティを処理 ─────────────────────────────────────────────────────
	const propertyLines: string[] = [];
	const skippedComments: string[] = [];
	const usedTsNames = new Set<string>();
	let autoCounter = 1;

	for (const [notionPropName, prop] of Object.entries(properties)) {
		const defType = NOTION_TYPE_TO_PROPERTY_DEF_TYPE[prop.type];

		if (!defType) {
			skippedComments.push(
				`// スキップ: ${notionPropName} (未対応のプロパティ型: ${prop.type})`,
			);
			continue;
		}

		// TypeScript フィールド名の決定: columnMappings 優先 → 自動camelCase
		let tsName =
			columnMappings[notionPropName] ?? toTsCamelCase(notionPropName);

		if (tsName === null) {
			// 非ASCII名で自動変換不可 → property_N を割り当てて warn
			let autoName: string;
			do {
				autoName = `property_${autoCounter++}`;
			} while (usedTsNames.has(autoName));
			tsName = autoName;
			warn?.(
				`[${config.name}] プロパティ "${notionPropName}" は TypeScript 識別子に自動変換できないため "${tsName}" として生成しました。` +
					`\n  nhc.config.ts の columnMappings で明示マッピングを推奨します:` +
					`\n    columnMappings: { "${notionPropName}": "フィールド名" }`,
			);
		}

		// 重複チェック（同名の tsName が既に登録済みの場合は連番を付与）
		if (usedTsNames.has(tsName)) {
			let candidate: string;
			let suffix = 2;
			do {
				candidate = `${tsName}_${suffix++}`;
			} while (usedTsNames.has(candidate));
			tsName = candidate;
		}

		usedTsNames.add(tsName);

		const notionPropEscaped = notionPropName.includes('"')
			? notionPropName.replace(/"/g, '\\"')
			: notionPropName;
		propertyLines.push(
			`\t${tsName}: { type: "${defType}" as const, notion: "${notionPropEscaped}" },`,
		);
	}

	const separator = "// =".padEnd(62, "=");

	const lines: string[] = [
		separator,
		`// ${config.name}  (${dbName})`,
		`// Notion DB ID: ${id}`,
		separator,
		"",
		`export const ${varPrefix}SourceId = "${id}";`,
		"",
		`/** Notion DB "${dbName}" のプロパティマップ。nhc generate で自動生成。 */`,
		`export const ${varPrefix}Properties = {`,
		...propertyLines,
		`} as const;`,
		"",
		`export type ${capitalize(varPrefix)}Properties = typeof ${varPrefix}Properties;`,
	];

	if (skippedComments.length > 0) {
		lines.push("", ...skippedComments);
	}

	return lines.join("\n");
}

/** nhc-schema.ts 全体のコードを生成する。 */
export function generateSchemaFile(
	sources: ResolvedSource[],
	opts?: { warn?: (msg: string) => void },
): string {
	const header = [
		"// このファイルは nhc generate により自動生成されました。手動編集は nhc generate で上書きされます。",
		`// Generated: ${new Date().toISOString()}`,
		"",
		'import type { PropertyMap } from "@notion-headless-cms/core";',
		"",
	].join("\n");

	const blocks = sources.map((s) => generateSourceBlock(s, opts?.warn));

	return [header, ...blocks, ""].join("\n\n");
}

export type { ResolvedSource };
