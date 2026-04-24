import { CMSError } from "@notion-headless-cms/core";
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

type SemanticKind = "slug" | "status" | "publishedAt" | null;

/** Notion プロパティ型 → TS/Zod 表現と、semantic 検出の許容カテゴリのマップ */
const PROPERTY_TYPE_MAP: Record<
	string,
	{
		tsType: string;
		zodExpr: string;
		notionFieldType: string;
		semanticKind: SemanticKind;
	}
> = {
	title: {
		tsType: "string | null",
		zodExpr: "z.string().nullable()",
		notionFieldType: "title",
		semanticKind: null,
	},
	rich_text: {
		tsType: "string | null",
		zodExpr: "z.string().nullable()",
		notionFieldType: "richText",
		semanticKind: "slug",
	},
	select: {
		tsType: "string | null",
		zodExpr: "z.string().nullable()",
		notionFieldType: "select",
		semanticKind: "status",
	},
	status: {
		tsType: "string | null",
		zodExpr: "z.string().nullable()",
		notionFieldType: "select",
		semanticKind: "status",
	},
	multi_select: {
		tsType: "string[]",
		zodExpr: "z.array(z.string())",
		notionFieldType: "multiSelect",
		semanticKind: null,
	},
	date: {
		tsType: "string | null",
		zodExpr: "z.string().nullable()",
		notionFieldType: "date",
		semanticKind: "publishedAt",
	},
	number: {
		tsType: "number | null",
		zodExpr: "z.number().nullable()",
		notionFieldType: "number",
		semanticKind: null,
	},
	checkbox: {
		tsType: "boolean",
		zodExpr: "z.boolean()",
		notionFieldType: "checkbox",
		semanticKind: null,
	},
	url: {
		tsType: "string | null",
		zodExpr: "z.string().nullable()",
		notionFieldType: "url",
		semanticKind: null,
	},
};

function detectSlug(
	propName: string,
	fields: DataSourceFieldOptions | undefined,
): boolean {
	if (fields?.slug) return fields.slug === propName;
	return SLUG_NAMES.has(propName);
}

function detectStatus(
	propName: string,
	fields: DataSourceFieldOptions | undefined,
): boolean {
	if (fields?.status) return fields.status === propName;
	return STATUS_NAMES.has(propName) || STATUS_NAMES.has(propName.toLowerCase());
}

function detectPublishedAt(
	propName: string,
	fields: DataSourceFieldOptions | undefined,
): boolean {
	if (fields?.publishedAt) return fields.publishedAt === propName;
	return (
		PUBLISHED_AT_NAMES.has(propName) ||
		PUBLISHED_AT_NAMES.has(propName.toLowerCase())
	);
}

/** Notion プロパティ型から MappedField を生成 */
function mapProperty(
	propName: string,
	prop: DataSourceObjectResponse["properties"][string],
	fields: DataSourceFieldOptions | undefined,
): MappedField {
	// 明示マッピング優先 → 自動 camelCase → null（semantic/skipped フィールド以外はエラーになる）
	const tsName = fields?.properties?.[propName] ?? toTsCamelCase(propName);

	const typeInfo = PROPERTY_TYPE_MAP[prop.type];
	if (!typeInfo) {
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

	// semantic 検出はプロパティ型が許容するカテゴリのみ有効化
	const kind = typeInfo.semanticKind;
	return {
		tsName,
		tsType: typeInfo.tsType,
		zodExpr: typeInfo.zodExpr,
		notionFieldType: typeInfo.notionFieldType,
		notionPropName: propName,
		isSlug: kind === "slug" && detectSlug(propName, fields),
		isStatus: kind === "status" && detectStatus(propName, fields),
		isPublishedAt:
			kind === "publishedAt" && detectPublishedAt(propName, fields),
	};
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
		throw new CMSError({
			code: "cli/schema_invalid",
			message: `[${config.name}] fields.slug に "${fields.slug}" が指定されていますが、DB "${dbName}" に該当するプロパティが見つかりません。${hint}`,
			context: {
				operation: "generateSourceBlock",
				collection: config.name,
				dbName,
			},
		});
	}
	if (fields?.status && !(fields.status in properties)) {
		throw new CMSError({
			code: "cli/schema_invalid",
			message: `[${config.name}] fields.status に "${fields.status}" が指定されていますが、DB "${dbName}" に該当するプロパティが見つかりません。${hint}`,
			context: {
				operation: "generateSourceBlock",
				collection: config.name,
				dbName,
			},
		});
	}
	if (fields?.publishedAt && !(fields.publishedAt in properties)) {
		throw new CMSError({
			code: "cli/schema_invalid",
			message: `[${config.name}] fields.publishedAt に "${fields.publishedAt}" が指定されていますが、DB "${dbName}" に該当するプロパティが見つかりません。${hint}`,
			context: {
				operation: "generateSourceBlock",
				collection: config.name,
				dbName,
			},
		});
	}
	for (const notionPropName of Object.keys(fields?.properties ?? {})) {
		if (!(notionPropName in properties)) {
			throw new CMSError({
				code: "cli/schema_invalid",
				message: `[${config.name}] fields.properties に "${notionPropName}" が指定されていますが、DB "${dbName}" に該当するプロパティが見つかりません。${hint}`,
				context: {
					operation: "generateSourceBlock",
					collection: config.name,
					dbName,
				},
			});
		}
	}

	// ── 全プロパティをマッピング ────────────────────────────────────────────────
	const mapped: MappedField[] = [];
	for (const [propName, prop] of Object.entries(properties)) {
		mapped.push(mapProperty(propName, prop, fields));
	}

	// ── slug / status / publishedAt を特定 ────────────────────────────────────
	const slugField = mapped.find(
		(f) => f.isSlug && f.notionFieldType === "richText",
	);

	if (!slugField) {
		const suggestion = fields?.slug
			? ""
			: `\n  → fields.slug に rich_text 型プロパティ名を指定してください。`;
		throw new CMSError({
			code: "cli/schema_invalid",
			message: `[${config.name}] slug フィールドが見つかりませんでした。DB "${dbName}" に "slug" / "Slug" という名前の rich_text 型プロパティが存在するか確認してください。${suggestion}`,
			context: {
				operation: "generateSourceBlock",
				collection: config.name,
				dbName,
			},
		});
	}

	const statusField = mapped.find((f) => f.isStatus);
	const publishedAtField = mapped.find((f) => f.isPublishedAt);

	// ── extraFields: slug/status/publishedAt/title/skipped を除いた追加フィールド ──
	// isSlug=true のフィールドは選択されなかったスラッグ候補も含め除外する（重複 slug キー防止）
	const extraFields = mapped.filter(
		(f) =>
			!f.skipped &&
			!f.isSlug &&
			f !== statusField &&
			f !== publishedAtField &&
			f.notionFieldType !== "title",
	);

	// ── tsName が null の extraField はエラー（フォールバック廃止） ────────────────
	for (const f of extraFields) {
		if (f.tsName === null) {
			throw new CMSError({
				code: "cli/schema_invalid",
				message:
					`[${config.name}] プロパティ "${f.notionPropName}" は TypeScript 識別子に自動変換できません。\n` +
					`  → nhc.config.ts の fields.properties に追加してください:\n` +
					`     properties: { "${f.notionPropName}": "フィールド名" }`,
				context: {
					operation: "generateSourceBlock",
					collection: config.name,
					notionPropName: f.notionPropName,
				},
			});
		}
	}

	// TS interface のフィールド（BaseContentItem 由来の slug/status/publishedAt は除く）
	const interfaceFields = extraFields.filter((f) => !f.skipped);

	// status/publishedAt が検出された場合はオプションを必須に絞り込む semantic override
	const semanticOverrides: { tsName: string; tsType: string }[] = [];
	if (statusField)
		semanticOverrides.push({ tsName: "status", tsType: "string" });
	if (publishedAtField)
		semanticOverrides.push({ tsName: "publishedAt", tsType: "string" });
	const hasInterface =
		semanticOverrides.length > 0 || interfaceFields.length > 0;

	// Zod schema のフィールド（id + updatedAt は常に含む）
	// BaseContentItem の string 型と整合させるため null → "" に変換
	const NULLABLE_STRING = 'z.string().nullable().transform((s) => s ?? "")';
	const zodFields: string[] = [
		"\t\tid: z.string(),",
		"\t\tupdatedAt: z.string(),",
		`\t\tslug: ${NULLABLE_STRING},`,
		"\t\ttitle: z.string().nullable().optional(),",
	];
	if (statusField) zodFields.push(`\t\tstatus: ${NULLABLE_STRING},`);
	if (publishedAtField) zodFields.push(`\t\tpublishedAt: ${NULLABLE_STRING},`);
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
	if (hasInterface) {
		lines.push(`export interface ${typeName} extends BaseContentItem {`);
		for (const f of semanticOverrides) {
			lines.push(`\t${f.tsName}: ${f.tsType};`);
		}
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
	if (hasInterface) {
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

/**
 * `cmsDataSources` オブジェクトのコードを生成。
 * 各コレクションを `createNotionCollection` で生成済みの `DataSource<T>` として出力する。
 * ユーザーは `createCMS({ dataSources: cmsDataSources, ... })` にそのまま渡せる。
 *
 * `NOTION_TOKEN` は env() ヘルパー経由で遅延評価する。
 */
function generateCmsDataSources(sources: ResolvedSource[]): string {
	const lines: string[] = [
		"// =".padEnd(62, "="),
		"// CMS DataSources",
		"// =".padEnd(62, "="),
		"",
		"/**",
		" * 各コレクション名 → DataSource<T> のマップ。",
		" * createCMS({ dataSources: cmsDataSources, cache, ... }) に渡す。",
		" * ユーザーは notion-orm を直接 import する必要はない (CLI が自動生成する)。",
		" */",
		"export const cmsDataSources = {",
	];

	for (const source of sources) {
		lines.push(`\t${source.config.name}: createNotionCollection({`);
		lines.push('\t\ttoken: env("NOTION_TOKEN"),');
		lines.push(`\t\tdataSourceId: ${source.config.name}SourceId,`);
		lines.push(`\t\tschema: ${source.config.name}Schema,`);
		lines.push("\t}),");
	}

	lines.push("} as const;");
	lines.push("");
	lines.push("export type CMSDataSources = typeof cmsDataSources;");

	return lines.join("\n");
}

/** nhc-schema.ts 全体のコードを生成 */
export function generateSchemaFile(sources: ResolvedSource[]): string {
	const header = [
		"// このファイルは nhc generate により自動生成されました。手動編集は nhc generate で上書きされます。",
		`// Generated: ${new Date().toISOString()}`,
		"",
		'import { z } from "zod";',
		"import {",
		"\tcreateNotionCollection,",
		"\tdefineMapping,",
		"\tdefineSchema,",
		'} from "@notion-headless-cms/notion-orm";',
		'import type { BaseContentItem } from "@notion-headless-cms/core";',
		'import { env } from "@notion-headless-cms/cli";',
		"",
	].join("\n");

	const blocks = sources.map((s) => generateSourceBlock(s));
	const cmsDataSources = generateCmsDataSources(sources);

	return [header, ...blocks, "", cmsDataSources, ""].join("\n");
}

export type { ResolvedSource };
