import type {
	BaseContentItem,
	CMSSchemaProperties,
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
