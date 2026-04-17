import type {
	PageObjectResponse,
	PartialUserObjectResponse,
	RichTextItemResponse,
	UserObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { z } from "zod";
import { NotionHeadlessCMSError } from "./errors";
import type { CMSSchemaProperties, ContentItem } from "./types";

const contentItemSchema = z.object({
	id: z.string().min(1),
	title: z.string(),
	slug: z.string(),
	status: z.string(),
	publishedAt: z.string().min(1),
	author: z.string(),
	updatedAt: z.string().min(1),
});

/** Notionリッチテキスト配列をプレーンテキストに結合する。 */
export function getPlainText(
	items: RichTextItemResponse[] | undefined,
): string {
	return items?.map((item) => item.plain_text).join("") ?? "";
}

/** NotionページのAuthorプロパティから著者名を取得する。select・rich_text・people の各形式に対応。 */
function getAuthor(page: PageObjectResponse, authorProp: string): string {
	const authorProperty = page.properties[authorProp] as
		| {
				rich_text?: RichTextItemResponse[];
				select?: { name: string } | null;
				people?: (UserObjectResponse | PartialUserObjectResponse)[];
		  }
		| undefined;

	if (authorProperty?.select?.name) return authorProperty.select.name;
	if (authorProperty?.people?.length) {
		return authorProperty.people
			.map((u) => ("name" in u ? u.name : null))
			.filter((name): name is string => !!name)
			.join(", ");
	}
	return getPlainText(authorProperty?.rich_text);
}

/**
 * NotionのPageObjectResponseをデフォルトの ContentItem に変換する。
 * カスタムマッピングのベースとして export しており、独自型を構築する際に利用できる。
 */
export function mapItem(
	page: PageObjectResponse,
	props: Required<CMSSchemaProperties>,
): ContentItem {
	const statusProperty = page.properties[props.status] as
		| { status?: { name: string } | null; select?: { name: string } | null }
		| undefined;
	const dateProperty = page.properties[props.date] as
		| { date?: { start: string } | null }
		| undefined;

	const parsed = contentItemSchema.safeParse({
		id: page.id,
		title: getPlainText(
			(
				page.properties[props.title] as
					| { title?: RichTextItemResponse[] }
					| undefined
			)?.title,
		),
		slug: getPlainText(
			(
				page.properties[props.slug] as
					| { rich_text?: RichTextItemResponse[] }
					| undefined
			)?.rich_text,
		),
		status: statusProperty?.status?.name ?? statusProperty?.select?.name ?? "",
		publishedAt: dateProperty?.date?.start ?? page.created_time,
		author: getAuthor(page, props.author),
		updatedAt: page.last_edited_time,
	});

	if (!parsed.success) {
		throw new NotionHeadlessCMSError({
			code: "NOTION_ITEM_SCHEMA_INVALID",
			message: "Failed to parse Notion page into ContentItem.",
			context: {
				operation: "mapItem",
				pageId: page.id,
				issues: JSON.stringify(parsed.error.issues),
			},
		});
	}

	return parsed.data;
}
