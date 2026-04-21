import type { z } from "zod";
import { getPlainText } from "./mapper";
import type { NotionPage } from "./types";

// ── ページプロパティ値の型エイリアス ────────────────────────────────────────
// NotionPage["properties"][string] から各プロパティの要素型を導出する。
// これにより @notionhq/client の型定義と常に同期される。

type PropertyValue = NotionPage["properties"][string];

type PeopleItem = Extract<PropertyValue, { type: "people" }>["people"][number];
type FileItem = Extract<PropertyValue, { type: "files" }>["files"][number];
type RelationItem = Extract<
	PropertyValue,
	{ type: "relation" }
>["relation"][number];
type SelectItem = Extract<
	PropertyValue,
	{ type: "multi_select" }
>["multi_select"][number];
type FormulaResult = Extract<PropertyValue, { type: "formula" }>["formula"];
type RollupResult = Extract<PropertyValue, { type: "rollup" }>["rollup"];
type UniqueIdResult = Extract<
	PropertyValue,
	{ type: "unique_id" }
>["unique_id"];
type CreatedByUser = Extract<
	PropertyValue,
	{ type: "created_by" }
>["created_by"];
type LastEditedByUser = Extract<
	PropertyValue,
	{ type: "last_edited_by" }
>["last_edited_by"];

// ── 複合型の値インターフェース ────────────────────────────────────────────────

/** `created_by` / `last_edited_by` プロパティのユーザー情報。 */
export interface NotionPersonValue {
	id: string;
	name?: string;
}

/** `files` プロパティの各ファイル情報。URL は外部 / Notion ホスト型の両方から抽出済み。 */
export interface NotionFileValue {
	name: string;
	url: string;
	type: "external" | "file";
}

/** `relation` プロパティの各ページ参照。 */
export interface NotionRelationValue {
	id: string;
}

/** `formula` プロパティの計算結果。date 型フォーミュラは null を返す。 */
export type NotionFormulaValue = string | number | boolean | null;

/** `unique_id` プロパティの値。 */
export interface NotionUniqueIdValue {
	number: number;
	prefix: string | null;
}

/** `rollup` プロパティの集計値。集計関数に応じて型が変わるため Notion の型をそのまま使用。 */
export type NotionRollupValue = RollupResult;

// ── フィールドマッピング型定義 ──────────────────────────────────────────────

export type NotionFieldType =
	| {
			type:
				| "title"
				| "richText"
				| "url"
				| "checkbox"
				| "date"
				| "number"
				| "email"
				| "phone_number"
				| "created_time"
				| "last_edited_time"
				| "formula"
				| "rollup"
				| "unique_id";
			notion: string;
	  }
	| { type: "multiSelect" | "relation" | "people" | "files"; notion: string }
	| {
			type: "select" | "status";
			notion: string;
			published?: string[];
			accessible?: string[];
	  }
	| { type: "created_by" | "last_edited_by"; notion: string };

// id・updatedAt は Notion ページメタデータから自動設定されるシステムフィールド
type SystemField = "id" | "updatedAt";

// ── defineMapping ────────────────────────────────────────────────────────────

/**
 * Notion プロパティマッピングを定義する。
 * `id` / `updatedAt` はシステムフィールドのため指定不要。
 * 型レベルでキーがスキーマと一致することを保証する。ランタイムは恒等関数。
 */
export function defineMapping<T extends Record<string, unknown>>(
	mapping: { [K in keyof Omit<T, SystemField>]: NotionFieldType },
): { [K in keyof Omit<T, SystemField>]: NotionFieldType } {
	return mapping;
}

// ── NotionSchema オブジェクト型 ──────────────────────────────────────────────

export interface NotionSchema<T> {
	mapping: { [K in keyof T]: NotionFieldType };
	mapItem: (page: NotionPage) => T;
	publishedStatuses: readonly string[];
	accessibleStatuses: readonly string[];
}

// ── defineSchema ─────────────────────────────────────────────────────────────

/**
 * Zod スキーマとマッピングを結合して NotionSchema を生成する。
 *
 * @example
 * const PostSchema = z.object({ slug: z.string(), status: z.string() })
 * const mapping = defineMapping<z.infer<typeof PostSchema>>({
 *   slug: { notion: "Slug", type: "richText" },
 *   status: { notion: "Status", type: "status", published: ["Published"] },
 * })
 * const schema = defineSchema(PostSchema, mapping)
 */
export function defineSchema<S extends z.ZodRawShape>(
	zodSchema: z.ZodObject<S>,
	mapping: {
		[K in keyof Omit<z.infer<z.ZodObject<S>>, SystemField>]: NotionFieldType;
	},
): NotionSchema<z.infer<z.ZodObject<S>>> {
	type T = z.infer<z.ZodObject<S>>;

	const published: string[] = [];
	const accessible: string[] = [];

	for (const fieldDef of Object.values(mapping) as NotionFieldType[]) {
		if (fieldDef.type === "select" || fieldDef.type === "status") {
			published.push(...(fieldDef.published ?? []));
			accessible.push(...(fieldDef.accessible ?? fieldDef.published ?? []));
		}
	}

	return {
		mapping: mapping as { [K in keyof T]: NotionFieldType },
		mapItem: (page) => {
			const raw = parseMapping(
				page,
				mapping as { [K in keyof T]: NotionFieldType },
			);
			return zodSchema.parse(raw) as T;
		},
		publishedStatuses: published,
		accessibleStatuses: accessible,
	};
}

// ── パーサー ─────────────────────────────────────────────────────────────────

const ARRAY_FIELD_TYPES = new Set([
	"multiSelect",
	"relation",
	"people",
	"files",
]);

// id と updatedAt は Notion ページのメタデータから自動設定されるシステムフィールド
const SYSTEM_FIELDS = new Set(["id", "updatedAt"]);

function parseMapping<T>(
	page: NotionPage,
	mapping: { [K in keyof T]: NotionFieldType },
): Record<string, unknown> {
	const result: Record<string, unknown> = {
		id: page.id,
		updatedAt: page.last_edited_time,
	};
	for (const [key, fieldDef] of Object.entries(mapping) as [
		string,
		NotionFieldType,
	][]) {
		if (SYSTEM_FIELDS.has(key)) continue;
		result[key] = parseField(page.properties[fieldDef.notion], fieldDef);
	}
	return result;
}

function parseField(
	prop: PropertyValue | undefined,
	fieldDef: NotionFieldType,
): unknown {
	if (!prop) {
		if (fieldDef.type === "checkbox") return false;
		if (ARRAY_FIELD_TYPES.has(fieldDef.type)) return [];
		return null;
	}

	switch (fieldDef.type) {
		case "title":
			return getPlainText(prop.type === "title" ? prop.title : []) || null;
		case "richText":
			return (
				getPlainText(prop.type === "rich_text" ? prop.rich_text : []) || null
			);
		case "date":
			return prop.type === "date" ? (prop.date?.start ?? null) : null;
		case "number":
			return prop.type === "number" ? prop.number : null;
		case "checkbox":
			return prop.type === "checkbox" ? prop.checkbox : false;
		case "url":
			return prop.type === "url" ? prop.url : null;
		case "email":
			return prop.type === "email" ? prop.email : null;
		case "phone_number":
			return prop.type === "phone_number" ? prop.phone_number : null;
		case "created_time":
			return prop.type === "created_time" ? prop.created_time : null;
		case "last_edited_time":
			return prop.type === "last_edited_time" ? prop.last_edited_time : null;
		case "multiSelect":
			return prop.type === "multi_select"
				? prop.multi_select.map((s: SelectItem): string => s.name)
				: [];
		case "select":
			return prop.type === "select" ? (prop.select?.name ?? null) : null;
		case "status":
			return prop.type === "status" ? (prop.status?.name ?? null) : null;
		case "people":
			return prop.type === "people"
				? prop.people.map(
						(u: PeopleItem): string =>
							("name" in u ? (u.name ?? null) : null) ?? u.id,
					)
				: [];
		case "files":
			return prop.type === "files"
				? prop.files.map(
						(f: FileItem): NotionFileValue => ({
							name: f.name,
							url: f.type === "external" ? f.external.url : f.file.url,
							type: f.type,
						}),
					)
				: [];
		case "relation":
			return prop.type === "relation"
				? prop.relation.map(
						(r: RelationItem): NotionRelationValue => ({ id: r.id }),
					)
				: [];
		case "formula": {
			if (prop.type !== "formula") return null;
			const f: FormulaResult = prop.formula;
			if (f.type === "number") return f.number;
			if (f.type === "string") return f.string;
			if (f.type === "boolean") return f.boolean;
			return null;
		}
		case "rollup":
			return prop.type === "rollup"
				? (prop.rollup satisfies RollupResult)
				: null;
		case "unique_id": {
			if (prop.type !== "unique_id") return null;
			const uid: UniqueIdResult = prop.unique_id;
			if (uid.number === null) return null;
			return {
				number: uid.number,
				prefix: uid.prefix ?? null,
			} satisfies NotionUniqueIdValue;
		}
		case "created_by": {
			if (prop.type !== "created_by") return null;
			const u: CreatedByUser = prop.created_by;
			return {
				id: u.id,
				name: "name" in u ? (u.name ?? undefined) : undefined,
			} satisfies NotionPersonValue;
		}
		case "last_edited_by": {
			if (prop.type !== "last_edited_by") return null;
			const u: LastEditedByUser = prop.last_edited_by;
			return {
				id: u.id,
				name: "name" in u ? (u.name ?? undefined) : undefined,
			} satisfies NotionPersonValue;
		}
	}
}
