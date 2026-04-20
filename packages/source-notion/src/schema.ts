import type {
	PageObjectResponse,
	RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";
import type { z } from "zod";

// ── フィールドマッピング型定義 ──────────────────────────────────────────────

export type NotionFieldType =
	| {
			type: "title" | "richText" | "url" | "checkbox" | "date" | "number";
			notion: string;
	  }
	| { type: "multiSelect"; notion: string }
	| {
			type: "select";
			notion: string;
			published?: string[];
			accessible?: string[];
	  };

// ── defineMapping ────────────────────────────────────────────────────────────

/**
 * Notion プロパティマッピングを定義する。
 * 型レベルでキーがスキーマと一致することを保証する。ランタイムは恒等関数。
 */
export function defineMapping<T extends Record<string, unknown>>(
	mapping: { [K in keyof T]: NotionFieldType },
): { [K in keyof T]: NotionFieldType } {
	return mapping;
}

// ── NotionSchema オブジェクト型 ──────────────────────────────────────────────

export interface NotionSchema<T> {
	zodSchema: z.ZodObject<z.ZodRawShape>;
	mapping: { [K in keyof T]: NotionFieldType };
	mapItem: (page: PageObjectResponse) => T;
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
 *   status: { notion: "Status", type: "select", published: ["Published"] },
 * })
 * const schema = defineSchema(PostSchema, mapping)
 */
export function defineSchema<S extends z.ZodRawShape>(
	zodSchema: z.ZodObject<S>,
	mapping: { [K in keyof z.infer<z.ZodObject<S>>]: NotionFieldType },
): NotionSchema<z.infer<z.ZodObject<S>>> {
	type T = z.infer<z.ZodObject<S>>;

	const published: string[] = [];
	const accessible: string[] = [];

	for (const fieldDef of Object.values(mapping) as NotionFieldType[]) {
		if (fieldDef.type === "select") {
			published.push(...(fieldDef.published ?? []));
			accessible.push(...(fieldDef.accessible ?? fieldDef.published ?? []));
		}
	}

	return {
		zodSchema: zodSchema as z.ZodObject<z.ZodRawShape>,
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

type PropertyValue = PageObjectResponse["properties"][string];

export function getPlainText(
	items: RichTextItemResponse[] | undefined,
): string {
	return items?.map((item) => item.plain_text).join("") ?? "";
}

// id と updatedAt は Notion ページのメタデータから自動設定されるシステムフィールド
const SYSTEM_FIELDS = new Set(["id", "updatedAt"]);

function parseMapping<T>(
	page: PageObjectResponse,
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
		if (fieldDef.type === "multiSelect") return [];
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
		case "multiSelect":
			return prop.type === "multi_select"
				? prop.multi_select.map((s) => s.name)
				: [];
		case "select": {
			const raw =
				prop.type === "select"
					? (prop.select?.name ?? "")
					: prop.type === "status"
						? ((prop as { status?: { name: string } }).status?.name ?? "")
						: "";
			return raw || null;
		}
	}
}
