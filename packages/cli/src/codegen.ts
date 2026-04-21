import type { DataSourceConfig, DataSourceFieldOptions } from "./index.js";
import type { DataSourceObjectResponse } from "./notion-client.js";

interface ResolvedSource {
	config: DataSourceConfig;
	id: string;
	dbName: string;
	properties: DataSourceObjectResponse["properties"];
}

interface MappedField {
	tsName: string;
	tsType: string;
	zodExpr: string;
	notionFieldType: string;
	notionPropName: string;
	isSlug: boolean;
	isStatus: boolean;
	isPublishedAt: boolean;
	/** select フィールドで published/accessible が指定されているか */
	published: string[];
	accessible: string[];
	/** 非推奨プロパティ型のためスキップされた */
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
	fieldIndex: number,
	fields: DataSourceFieldOptions | undefined,
): MappedField | null {
	const tsName = toTsCamelCase(propName) ?? `field_${fieldIndex}`;
	const isSlug =
		fields?.slug === propName ||
		(!fields?.slug && (SLUG_NAMES.has(propName) || prop.type === "title"));
	const isStatus =
		fields?.status === propName ||
		(!fields?.status &&
			(STATUS_NAMES.has(propName) || STATUS_NAMES.has(propName.toLowerCase())));
	const isPublishedAt =
		fields?.publishedAt === propName ||
		(!fields?.publishedAt && PUBLISHED_AT_NAMES.has(propName)) ||
		PUBLISHED_AT_NAMES.has(propName.toLowerCase());

	const published = isStatus ? (fields?.published ?? []) : [];
	const accessible = isStatus
		? (fields?.accessible ?? fields?.published ?? [])
		: [];

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
				published: [],
				accessible: [],
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
				published: [],
				accessible: [],
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
				published,
				accessible,
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
				published: [],
				accessible: [],
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
				published: [],
				accessible: [],
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
				published: [],
				accessible: [],
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
				published: [],
				accessible: [],
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
				published: [],
				accessible: [],
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
				published: [],
				accessible: [],
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

	// 全プロパティをマッピング
	const mapped: MappedField[] = [];
	let fieldIndex = 0;
	for (const [propName, prop] of Object.entries(properties)) {
		const f = mapProperty(propName, prop, fieldIndex++, fields);
		if (f) mapped.push(f);
	}

	// slug フィールドを特定（title 型から自動検出または指定）
	let slugField = mapped.find((f) => f.isSlug && f.notionFieldType === "title");
	if (!slugField) {
		// title 型がなければ richText で slug 名のものを探す
		slugField = mapped.find(
			(f) => f.isSlug && f.notionFieldType === "richText",
		);
	}
	if (!slugField) {
		// フォールバック: 最初の title 型
		slugField = mapped.find((f) => f.notionFieldType === "title");
	}

	const statusField = mapped.find((f) => f.isStatus);
	const publishedAtField = mapped.find((f) => f.isPublishedAt);

	// システムフィールド以外の追加フィールド
	const extraFields = mapped.filter(
		(f) =>
			!f.skipped &&
			f !== slugField &&
			f !== statusField &&
			f !== publishedAtField &&
			f.notionFieldType !== "title", // title はすでに slug として扱う
	);

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
	const mappingLines: string[] = [];

	if (slugField) {
		mappingLines.push(
			`\t\tslug: { type: "${slugField.notionFieldType}", notion: "${slugField.notionPropName}" },`,
		);
	} else {
		mappingLines.push(
			`\t\tslug: { type: "richText", notion: "Slug" }, // TODO: slug フィールドが見つかりませんでした`,
		);
	}

	if (statusField) {
		const pubStr =
			statusField.published.length > 0
				? statusField.published.map((s) => `"${s}"`).join(", ")
				: "";
		const accStr =
			statusField.accessible.length > 0
				? statusField.accessible.map((s) => `"${s}"`).join(", ")
				: "";
		const hasTodo =
			statusField.published.length === 0
				? " // TODO: 公開ステータスを設定してください"
				: "";
		mappingLines.push(
			`\t\tstatus: { type: "select", notion: "${statusField.notionPropName}", published: [${pubStr}], accessible: [${accStr}] },${hasTodo}`,
		);
	}

	if (publishedAtField) {
		mappingLines.push(
			`\t\tpublishedAt: { type: "date", notion: "${publishedAtField.notionPropName}" },`,
		);
	}

	for (const f of interfaceFields) {
		if (f.notionFieldType === "select" || f.notionFieldType === "multiSelect") {
			if (f.notionFieldType === "select") {
				mappingLines.push(
					`\t\t${f.tsName}: { type: "select", notion: "${f.notionPropName}", published: [], accessible: [] },`,
				);
			} else {
				mappingLines.push(
					`\t\t${f.tsName}: { type: "${f.notionFieldType}", notion: "${f.notionPropName}" },`,
				);
			}
		} else {
			mappingLines.push(
				`\t\t${f.tsName}: { type: "${f.notionFieldType}", notion: "${f.notionPropName}" },`,
			);
		}
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
