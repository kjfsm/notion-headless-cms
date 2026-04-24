import type {
	BaseContentItem,
	CMSSchemaProperties,
	PropertyMap,
} from "@notion-headless-cms/core";
import { CMSError } from "@notion-headless-cms/core";
import { z } from "zod";
import type { NotionPage, NotionRichTextItem } from "./types";

const baseContentItemSchema = z.object({
	id: z.string().min(1),
	slug: z.string().min(1),
	title: z.string().nullable().optional(),
	updatedAt: z.string().min(1),
	status: z.string().optional(),
	publishedAt: z.string().optional(),
});

/** Notionリッチテキスト配列をプレーンテキストに結合する。 */
export function getPlainText(items: NotionRichTextItem[] | undefined): string {
	return items?.map((item) => item.plain_text).join("") ?? "";
}

/**
 * Notion ページを CLI 生成の PropertyMap に従ってフラットな Record に変換する。
 * ページ構成の知識（slug/status の意味）を持たず、すべてのプロパティを等しく扱う。
 * slug・title・updatedAt などの BaseContentItem フィールドも含む。
 */
export function mapItemFromPropertyMap(
	page: NotionPage,
	properties: PropertyMap,
): BaseContentItem {
	const titleProp = Object.values(page.properties).find(
		(p) => p.type === "title",
	);
	const title =
		titleProp !== undefined && titleProp.type === "title"
			? getPlainText(titleProp.title) || null
			: null;

	const result: Record<string, unknown> = {
		id: page.id,
		updatedAt: page.last_edited_time,
		title,
		slug: "",
	};

	for (const [tsName, propDef] of Object.entries(properties)) {
		const prop = page.properties[propDef.notion];
		result[tsName] = extractPropertyValue(prop, propDef.type);
	}

	return result as unknown as BaseContentItem;
}

type PropValue = NotionPage["properties"][string] | undefined;

function extractPropertyValue(prop: PropValue, type: PropertyMap[string]["type"]): unknown {
	if (!prop) {
		if (type === "checkbox") return false;
		if (type === "multiSelect") return [];
		return null;
	}
	switch (type) {
		case "title":
			return prop.type === "title" ? getPlainText(prop.title) || null : null;
		case "richText":
			return prop.type === "rich_text"
				? getPlainText(prop.rich_text) || null
				: null;
		case "select":
			if (prop.type === "select") return prop.select?.name ?? null;
			if (prop.type === "status")
				return (prop as { status?: { name: string } | null }).status?.name ?? null;
			return null;
		case "multiSelect":
			return prop.type === "multi_select"
				? prop.multi_select.map((s: { name: string }) => s.name)
				: [];
		case "date":
			return prop.type === "date" ? (prop.date?.start ?? null) : null;
		case "number":
			return prop.type === "number" ? prop.number : null;
		case "checkbox":
			return prop.type === "checkbox" ? prop.checkbox : false;
		case "url":
			return prop.type === "url" ? prop.url : null;
		default:
			return null;
	}
}

/**
 * Notion ページをデフォルトの BaseContentItem に変換する。
 * 独自の拡張型（title などを含む）が必要な場合は、本関数の戻り値に
 * 追加フィールドを足してカスタム mapItem を実装する。
 */
export function mapItem(
	page: NotionPage,
	props: Required<CMSSchemaProperties>,
): BaseContentItem {
	const statusProperty = page.properties[props.status] as
		| { status?: { name: string } | null; select?: { name: string } | null }
		| undefined;
	const dateProperty = page.properties[props.date] as
		| { date?: { start: string } | null }
		| undefined;

	const titleProp = Object.values(page.properties).find(
		(p) => p.type === "title",
	);
	const title =
		titleProp !== undefined && titleProp.type === "title"
			? getPlainText(titleProp.title) || null
			: null;

	const parsed = baseContentItemSchema.safeParse({
		id: page.id,
		slug: getPlainText(
			(
				page.properties[props.slug] as
					| { rich_text?: NotionRichTextItem[] }
					| undefined
			)?.rich_text,
		),
		title,
		status: statusProperty?.status?.name ?? statusProperty?.select?.name,
		publishedAt: dateProperty?.date?.start ?? page.created_time,
		updatedAt: page.last_edited_time,
	});

	if (!parsed.success) {
		throw new CMSError({
			code: "core/schema_invalid",
			message: "Failed to parse Notion page into BaseContentItem.",
			context: {
				operation: "mapItem",
				pageId: page.id,
				issues: JSON.stringify(parsed.error.issues),
			},
		});
	}

	return parsed.data;
}
