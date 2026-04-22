import type { DataSourceConfig, DataSourceFieldOptions } from "./index.js";
import type { DataSourceObjectResponse } from "./notion-client.js";

interface ResolvedSource {
	config: DataSourceConfig;
	id: string;
	dbName: string;
	properties: DataSourceObjectResponse["properties"];
}

interface MappedField {
	/** null = ASCII 変換不可かつ fields.properties 未指定（semantic/skipped フィールドのみ許容） */
	tsName: string | null;
	tsType: string;
	zodExpr: string;
	notionFieldType: string;
	notionPropName: string;
	isSlug: boolean;
	isStatus: boolean;
	isPublishedAt: boolean;
	/** 未対応プロパティ型のためスキップされた */
	skipped?: boolean;
	skipReason?: string;
}

const SLUG_NAMES = new Set(["slug", "Slug", "スラッグ"]);
const STATUS_NAMES = new Set(["status", "Status", "状態", "state", "State"]);
const PUBLISHED_AT_NAMES = new Set([
	"publishedat",
	"published at",
	"publishedAt",
	"PublishedAt",
	"createdat",
	"created at",
	"createdAt",
	"CreatedAt",
	"公開日",
	"公開日時",
]);

/** Notion プロパティ名を TypeScript の camelCase 識別子に変換 */
function toTsCamelCase(name: string): string | null {
	// ASCII 英数字・アンダースコアのみで構成されている場合
	const normalized = name
		.replace(/[\s-]+(.)/g, (_, c: string) => c.toUpperCase())
		.replace(/[^a-zA-Z0-9_]/g, "");

	if (!normalized) return null;

	// 先頭を小文字に
	return normalized.charAt(0).toLowerCase() + normalized.slice(1);
}

/** Notion プロパティ型から MappedField を生成 */
function mapProperty(
	propName: string,
	prop: DataSourceObjectResponse["properties"][string],
	fields: DataSourceFieldOptions | undefined,
): MappedField {
	// 明示マッピング優先 → 自動 camelCase → null（semantic/skipped フィールド以外はエラーになる）
	const tsName: string | null =
		fields?.properties?.[propName] ?? toTsCamelCase(propName) ?? null;

	const isSlug =
		fields?.slug === propName ||
		(!fields?.slug && (SLUG_NAMES.has(propName) || prop.type === "title"));
	const isStatus =
		fields?.status === propName ||
		(!fields?.status &&
			(STATUS_NAMES.has(propName) || STATUS_NAMES.has(propName.toLowerCase())));
	const isPublishedAt =
		fields?.publishedAt === propName ||
		(!fields?.publishedAt &&
			(PUBLISHED_AT_NAMES.has(propName) ||
				PUBLISHED_AT_NAMES.has(propName.toLowerCase())));

	switch (prop.type) {
		case "title":
			return {
				tsName,
				tsType: "string | null",
				zodExpr: "z.string().nullable()",
				notionFieldType: "title",
				notionPropName: propName,
				isSlug,
				isStatus: false,
				isPublishedAt: false,
			};

		case "rich_text":
			return {
				tsName,
				tsType: "string | null",
				zodExpr: "z.string().nullable()",
				notionFieldType: "richText",
				notionPropName: propName,
				isSlug,
				isStatus: false,
				isPublishedAt: false,
			};

		case "select":
		case "status":
			return {
				tsName,
				tsType: "string | null",
				zodExpr: "z.string().nullable()",
				notionFieldType: "select",
				notionPropName: propName,
				isSlug: false,
				isStatus,
				isPublishedAt: false,
			};

		case "multi_select":
			return {
				tsName,
				tsType: "string[]",
				zodExpr: "z.array(z.string())",
				notionFieldType: "multiSelect",
				notionPropName: propName,
				isSlug: false,
				isStatus: false,
				isPublishedAt: false,
			};

		case "date":
			return {
				tsName,
				tsType: "string | null",
				zodExpr: "z.string().nullable()",
				notionFieldType: "date",
				notionPropName: propName,
				isSlug: false,
				isStatus: false,
				isPublishedAt,
			};

		case "number":
			return {
				tsName,
				tsType: "number | null",
				zodExpr: "z.number().nullable()",
				notionFieldType: "number",
				notionPropName: propName,
				isSlug: false,
				isStatus: false,
				isPublishedAt: false,
			};

		case "checkbox":
			return {
				tsName,
				tsType: "boolean",
				zodExpr: "z.boolean()",
				notionFieldType: "checkbox",
				notionPropName: propName,
				isSlug: false,
				isStatus: false,
				isPublishedAt: false,
			};

		case "url":
			return {
				tsName,
				tsType: "string | null",
				zodExpr: "z.string().nullable()",
				notionFieldType: "url",
				notionPropName: propName,
				isSlug: false,
				isStatus: false,
				isPublishedAt: false,
			};

		default:
			return {
				tsName,
				tsType: "unknown",
				zodExpr: "z.unknown()",
				notionFieldType: "richText",
				notionPropName: propName,
				isSlug: false,
				isStatus: false,
				isPublishedAt: false,
				skipped: true,
				skipReason: `未対応のプロパティ型: ${prop.type}`,
			};
	}
}

/** 名前の先頭を大文字に（例: posts → Posts） */
function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

/** DB ソース1件分の TypeScript コードブロックを生成 */
function generateSourceBlock(source: ResolvedSource): string {
	const { config, id, dbName, properties } = source;
	const typeName = `${capitalize(config.name)}Item`;
	const varPrefix = config.name;
	const fields = config.fields;

	// ── 事前検証: fields で指定したプロパティが DB に存在するか ──────────────────
	const hint = `nhc.config.ts の "${config.name}" の fields を確認してください。`;
	if (fields?.slug && !(fields.slug in properties)) {
		throw new Error(
			`[${config.name}] fields.slug に "${fields.slug}" が指定されていますが、DB "${dbName}" に該当するプロパティが見つかりません。${hint}`,
		);
	}
	if (fields?.status && !(fields.status in properties)) {
		throw new Error(
			`[${config.name}] fields.status に "${fields.status}" が指定されていますが、DB "${dbName}" に該当するプロパティが見つかりません。${hint}`,
		);
	}
	if (fields?.publishedAt && !(fields.publishedAt in properties)) {
		throw new Error(
			`[${config.name}] fields.publishedAt に "${fields.publishedAt}" が指定されていますが、DB "${dbName}" に該当するプロパティが見つかりません。${hint}`,
		);
	}
	for (const notionPropName of Object.keys(fields?.properties ?? {})) {
		if (!(notionPropName in properties)) {
			throw new Error(
				`[${config.name}] fields.properties に "${notionPropName}" が指定されていますが、DB "${dbName}" に該当するプロパティが見つかりません。${hint}`,
			);
		}
	}

	// ── 全プロパティをマッピング ────────────────────────────────────────────────
	const mapped: MappedField[] = [];
	for (const [propName, prop] of Object.entries(properties)) {
		mapped.push(mapProperty(propName, prop, fields));
	}

	// ── slug / status / publishedAt を特定 ────────────────────────────────────
	const slugField =
		mapped.find((f) => f.isSlug && f.notionFieldType === "title") ??
		mapped.find((f) => f.isSlug && f.notionFieldType === "richText");

	if (!slugField) {
		const suggestion = fields?.slug
			? ""
			: `\n  → fields.slug に title 型プロパティ名を指定してください。`;
		throw new Error(
			`[${config.name}] slug フィールドが見つかりませんでした。DB "${dbName}" に title 型プロパティが存在するか確認してください。${suggestion}`,
		);
	}

	const statusField = mapped.find((f) => f.isStatus);
	const publishedAtField = mapped.find((f) => f.isPublishedAt);

	// ── extraFields: slug/status/publishedAt/title/skipped を除いた追加フィールド ──
	const extraFields = mapped.filter(
		(f) =>
			!f.skipped &&
			f !== slugField &&
			f !== statusField &&
			f !== publishedAtField &&
			f.notionFieldType !== "title",
	);

	// ── tsName が null の extraField はエラー（フォールバック廃止） ────────────────
	for (const f of extraFields) {
		if (f.tsName === null) {
			throw new Error(
				`[${config.name}] プロパティ "${f.notionPropName}" は TypeScript 識別子に自動変換できません。\n` +
					`  → nhc.config.ts の fields.properties に追加してください:\n` +
					`     properties: { "${f.notionPropName}": "フィールド名" }`,
			);
		}
	}

	// TS interface のフィールド（BaseContentItem 由来の slug/status/publishedAt は除く）
	const interfaceFields = extraFields.filter((f) => !f.skipped);

	// Zod schema のフィールド（id + updatedAt は常に含む）
	const zodFields: string[] = [
		"\t\tid: z.string(),",
		"\t\tupdatedAt: z.string(),",
		"\t\tslug: z.string().nullable(),",
	];
	if (statusField) zodFields.push("\t\tstatus: z.string().nullable(),");
	if (publishedAtField)
		zodFields.push("\t\tpublishedAt: z.string().nullable(),");
	for (const f of interfaceFields) {
		zodFields.push(`\t\t${f.tsName}: ${f.zodExpr},`);
	}

	// defineMapping のフィールド（id/updatedAt を除く全フィールド）
	const mappingLines: string[] = [
		`\t\tslug: { type: "${slugField.notionFieldType}", notion: "${slugField.notionPropName}" },`,
	];

	if (statusField) {
		mappingLines.push(
			`\t\tstatus: { type: "select", notion: "${statusField.notionPropName}" },`,
		);
	}

	if (publishedAtField) {
		mappingLines.push(
			`\t\tpublishedAt: { type: "date", notion: "${publishedAtField.notionPropName}" },`,
		);
	}

	for (const f of interfaceFields) {
		mappingLines.push(
			`\t\t${f.tsName}: { type: "${f.notionFieldType}", notion: "${f.notionPropName}" },`,
		);
	}

	// スキップされたプロパティのコメント
	const skippedComments = mapped
		.filter((f) => f.skipped)
		.map((f) => `// スキップ: ${f.notionPropName} (${f.skipReason})`);

	const separator = "// =".padEnd(62, "=");

	const lines: string[] = [
		separator,
		`// ${config.name}  (${dbName})`,
		`// Notion DB ID: ${id}`,
		separator,
		"",
	];

	// interface
	if (interfaceFields.length > 0) {
		lines.push(`export interface ${typeName} extends BaseContentItem {`);
		for (const f of interfaceFields) {
			lines.push(`\t${f.tsName}: ${f.tsType};`);
		}
		lines.push("}");
	} else {
		lines.push(`export type ${typeName} = BaseContentItem;`);
	}
	lines.push("");

	// Zod schema
	lines.push(`const _${varPrefix}ZodSchema = z.object({`);
	lines.push(...zodFields);
	lines.push("});");
	lines.push("");

	// defineMapping
	if (interfaceFields.length > 0) {
		lines.push(`const _${varPrefix}Mapping = defineMapping<${typeName}>({`);
	} else {
		lines.push(`const _${varPrefix}Mapping = defineMapping<BaseContentItem>({`);
	}
	lines.push(...mappingLines);
	lines.push("});");
	lines.push("");

	// スキップコメント
	if (skippedComments.length > 0) {
		lines.push(...skippedComments);
		lines.push("");
	}

	// defineSchema
	lines.push(
		`export const ${varPrefix}Schema = defineSchema(_${varPrefix}ZodSchema, _${varPrefix}Mapping);`,
	);
	lines.push(`export const ${varPrefix}SourceId = "${id}";`);

	return lines.join("\n");
}

/** nhcSchema オブジェクトのコードを生成 */
function generateNhcSchema(sources: ResolvedSource[]): string {
	const lines: string[] = [
		"// =".padEnd(62, "="),
		"// NHC Multi-Source Schema",
		"// =".padEnd(62, "="),
		"",
		"export const nhcSchema = {",
	];

	for (const source of sources) {
		lines.push(`\t${source.config.name}: {`);
		lines.push(`\t\tid: ${source.config.name}SourceId,`);
		lines.push(`\t\tdbName: "${source.dbName}",`);
		lines.push(`\t\tschema: ${source.config.name}Schema,`);
		lines.push("\t},");
	}

	lines.push("} as const;");
	lines.push("");
	lines.push("export type NHCSchema = typeof nhcSchema;");

	return lines.join("\n");
}

/** nhc-schema.ts 全体のコードを生成 */
export function generateSchemaFile(sources: ResolvedSource[]): string {
	const header = [
		"// このファイルは nhc generate により自動生成されました。手動編集は nhc generate で上書きされます。",
		`// Generated: ${new Date().toISOString()}`,
		"",
		'import { z } from "zod";',
		'import { defineMapping, defineSchema } from "@notion-headless-cms/source-notion";',
		'import type { BaseContentItem } from "@notion-headless-cms/core";',
		"",
	].join("\n");

	const blocks = sources.map((s) => generateSourceBlock(s));
	const nhcSchema = generateNhcSchema(sources);

	return [header, ...blocks, "", nhcSchema, ""].join("\n");
}

export type { ResolvedSource };
