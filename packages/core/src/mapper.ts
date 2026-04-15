import type {
	PageObjectResponse,
	RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { z } from "zod";
import { CMSError } from "./errors";
import type { BaseContentItem, CMSSchemaProperties } from "./types";

const baseContentItemSchema = z.object({
	id: z.string().min(1),
	slug: z.string(),
	status: z.string(),
	publishedAt: z.string().min(1),
	updatedAt: z.string().min(1),
});

/** Notionリッチテキスト配列をプレーンテキストに結合する。 */
export function getPlainText(
	items: RichTextItemResponse[] | undefined,
): string {
	return items?.map((item) => item.plain_text).join("") ?? "";
}

/**
 * NotionのPageObjectResponseをデフォルトの BaseContentItem に変換する。
 * 独自の拡張型（title などを含む）が必要な場合は、本関数の戻り値に
 * 追加フィールドを足してカスタム mapItem を実装する。
 */
export function mapItem(
	page: PageObjectResponse,
	props: Required<CMSSchemaProperties>,
): BaseContentItem {
	const statusProperty = page.properties[props.status] as
		| { status?: { name: string } | null; select?: { name: string } | null }
		| undefined;
	const dateProperty = page.properties[props.date] as
		| { date?: { start: string } | null }
		| undefined;

	const parsed = baseContentItemSchema.safeParse({
		id: page.id,
		slug: getPlainText(
			(
				page.properties[props.slug] as
					| { rich_text?: RichTextItemResponse[] }
					| undefined
			)?.rich_text,
		),
		status: statusProperty?.status?.name ?? statusProperty?.select?.name ?? "",
		publishedAt: dateProperty?.date?.start ?? page.created_time,
		updatedAt: page.last_edited_time,
	});

	if (!parsed.success) {
		throw new CMSError({
			code: "NOTION_ITEM_SCHEMA_INVALID",
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
