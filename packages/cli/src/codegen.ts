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
	last_edited_time: "lastEditedTime",
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
		case "lastEditedTime":
			return "string";
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
	const columnMappings = config.columnMappings ?? {};

	// 事前検証: columnMappings で指定したプロパティが DB に存在するか
	for (const notionPropName of Object.keys(columnMappings)) {
		if (!(notionPropName in properties)) {
			throw new CMSError({
				code: "cli/schema_invalid",
				message: `[${name}] columnMappings に "${notionPropName}" が指定されていますが、DB "${dbName}" に該当するプロパティが見つかりません。`,
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

		let tsName =
			columnMappings[notionPropName] ?? toTsCamelCase(notionPropName);
		if (tsName === null) {
			throw new CMSError({
				code: "cli/schema_invalid",
				message:
					`[${name}] プロパティ "${notionPropName}" は TypeScript 識別子に自動変換できません。` +
					` columnMappings で明示マッピングを指定してください: { "${notionPropName}": "fieldName" }`,
				context: {
					operation: "resolveFields",
					collection: name,
					notionPropName,
				},
			});
		}

		// 重複時は連番を付与
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
	const slugField = config.slugField ?? "slug";
	const statusField = config.statusField ?? "status";

	const propertyLines = resolved.fields.map((f) => {
		const escaped = f.notionName.replace(/"/g, '\\"');
		return `\t${f.tsName}: { type: "${f.defType}" as const, notion: "${escaped}" },`;
	});

	// アイテム型: 必須フィールド (id, updatedAt) + Notion プロパティ
	const itemFieldLines: string[] = [
		"\t/** Notion ページ ID。 */",
		"\tid: string;",
		"\t/** Notion ページの最終更新時刻 (ISO8601)。 */",
		"\tupdatedAt: string;",
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
	// BaseContentItem に必須なフィールドを補完
	if (!hasSlug) {
		itemFieldLines.push("\t/** URL key。 */", "\tslug: string;");
	}
	if (!hasStatus) {
		itemFieldLines.push("\t/** ステータス。 */", "\tstatus?: string;");
	}
	if (!hasTitle) {
		itemFieldLines.push(
			"\t/** Notion ページタイトル。 */",
			"\ttitle?: string | null;",
		);
	}
	if (!hasPublishedAt) {
		itemFieldLines.push(
			"\t/** 公開日時 (ISO8601)。 */",
			"\tpublishedAt?: string;",
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

/** `createCMS` ファクトリと `Nhc` 型を生成する。 */
function generateClientBlock(collections: ResolvedCollection[]): string {
	const collectionNames = collections.map((c) => c.name);
	const itemTypes = collections.map((c) => pascal(c.name).replace(/s$/, ""));

	// Nhc 型: 各コレクションが CollectionClient<Item>
	const nhcMembers = collections.map((c, i) => {
		return `\t${c.name}: CollectionClient<${itemTypes[i]}>;`;
	});

	// createCMS 内部で構築する collections オブジェクト
	const innerCollections = collections.map((c) => {
		const slugField = c.config.slugField ?? "slug";
		const statusField = c.config.statusField ?? "status";
		const published = c.config.publishedStatuses
			? `[${c.config.publishedStatuses.map((s) => JSON.stringify(s)).join(", ")}] as const`
			: "[] as const";
		const accessible = c.config.accessibleStatuses
			? `[${c.config.accessibleStatuses.map((s) => JSON.stringify(s)).join(", ")}] as const`
			: undefined;
		const accessibleLine = accessible
			? `\n\t\t\t\taccessibleStatuses: ${accessible},`
			: "";
		return `\t\t\t${c.name}: {
				source: createNotionCollection({
					token: config.notionToken,
					dataSourceId: ${c.name}DataSourceId,
					properties: ${c.name}Properties,
				}),
				slugField: ${JSON.stringify(slugField)},
				statusField: ${JSON.stringify(statusField)},
				publishedStatuses: ${published},${accessibleLine}
			},`;
	});

	return `// =${"=".repeat(60)}
// CMS factory
// =${"=".repeat(60)}

/** \`createCMS()\` に渡すランタイム設定。Notion トークンとキャッシュ等を指定する。 */
export interface NhcConfig {
	/** Notion API トークン。 */
	notionToken: string;
	/** キャッシュアダプタ (単体または配列)。 */
	cache?: CacheAdapter | readonly CacheAdapter[];
	/** SWR の TTL (ミリ秒)。 */
	ttlMs?: number;
	/** カスタムレンダラー。未指定時は \`@notion-headless-cms/renderer\` を動的 import。 */
	renderer?: RendererFn;
	/** 画像プロキシのベース URL。デフォルト \`/api/images\`。 */
	imageProxyBase?: string;
	/** Cloudflare Workers の \`waitUntil\` 相当。 */
	waitUntil?: (p: Promise<unknown>) => void;
}

/** 生成された CMS クライアントの型。 */
export interface Nhc extends CMSGlobalOps {
${nhcMembers.join("\n")}
}

/**
 * Nhc クライアントを構築する。コレクションごとの DB ID とプロパティマップは生成時に固定済み。
 *
 * @example
 * import { createCMS } from "./generated/nhc";
 * import { memoryCache } from "@notion-headless-cms/cache";
 *
 * export const cms = createCMS({
 *   notionToken: process.env.NOTION_TOKEN!,
 *   cache: memoryCache({ ttlMs: 5 * 60_000 }),
 * });
 *
 * await cms.${collectionNames[0] ?? "posts"}.list();
 * const item = await cms.${collectionNames[0] ?? "posts"}.get("hello");
 * await item?.render();
 */
export function createCMS(config: NhcConfig): Nhc {
	return _createCMS({
		cache: config.cache,
		ttlMs: config.ttlMs,
		renderer: config.renderer,
		imageProxyBase: config.imageProxyBase,
		waitUntil: config.waitUntil,
		collections: {
${innerCollections.join("\n")}
		},
	}) as unknown as Nhc;
}
`;
}

/** nhc.ts 全体のコードを生成する。 */
export function generateSchemaFile(collections: ResolvedCollection[]): string {
	const header = [
		"// このファイルは nhc generate により自動生成されました。手動編集は nhc generate で上書きされます。",
		`// Generated: ${new Date().toISOString()}`,
		"",
		"import {",
		"\tcreateCMS as _createCMS,",
		"\ttype CacheAdapter,",
		"\ttype CMSGlobalOps,",
		"\ttype CollectionClient,",
		"\ttype PropertyMap,",
		"\ttype RendererFn,",
		'} from "@notion-headless-cms/core";',
		'import { createNotionCollection } from "@notion-headless-cms/notion-orm";',
		"",
	].join("\n");

	const blocks = collections.map((c) =>
		generateCollectionBlock(c, resolveFields(c)),
	);

	const client = generateClientBlock(collections);

	return [header, ...blocks, client, ""].join("\n\n");
}
