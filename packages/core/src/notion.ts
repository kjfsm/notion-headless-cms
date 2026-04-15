import { Client } from "@notionhq/client";
import type {
	PageObjectResponse,
	RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { NotionConverter } from "notion-to-md";
import type { NotionEnv } from "./types";

export type Post = {
	id: string;
	title: string;
	slug: string;
	status: string;
	createdAt: string;
	author: string;
	lastEdited: string;
};

// Notionリッチテキスト配列をプレーンテキストに結合する。
function getPlainText(items: RichTextItemResponse[] | undefined): string {
	return items?.map((item) => item.plain_text).join("") ?? "";
}

// NotionページのAuthorプロパティから著者名を取得する。selectとrich_textの両形式に対応。
function getAuthor(page: PageObjectResponse): string {
	const authorProperty = page.properties.Author as
		| { rich_text?: RichTextItemResponse[]; select?: { name: string } | null }
		| undefined;

	if (authorProperty?.select?.name) return authorProperty.select.name;
	return getPlainText(authorProperty?.rich_text);
}

// NotionのPageObjectResponseをアプリ内のPost型に変換する。
function mapPost(page: PageObjectResponse): Post {
	const statusProperty = page.properties.Status as
		| { status?: { name: string } | null; select?: { name: string } | null }
		| undefined;
	const createdAtProperty = page.properties.CreatedAt as
		| { date?: { start: string } | null }
		| undefined;

	return {
		id: page.id,
		title: getPlainText(
			(page.properties.Title as { title?: RichTextItemResponse[] } | undefined)
				?.title,
		),
		slug: getPlainText(
			(
				page.properties.Slug as
					| { rich_text?: RichTextItemResponse[] }
					| undefined
			)?.rich_text,
		),
		status:
			statusProperty?.status?.name ?? statusProperty?.select?.name ?? "下書き",
		createdAt: createdAtProperty?.date?.start ?? page.created_time,
		author: getAuthor(page),
		lastEdited: page.last_edited_time,
	};
}

// 環境変数のAPIキーでNotionクライアントを生成する。
export function getNotion(env: NotionEnv) {
	return new Client({ auth: env.NOTION_TOKEN });
}

// Notionデータソースから公開済み記事を取得し、作成日の降順で返す。
export async function getPosts(env: NotionEnv): Promise<Post[]> {
	if (!env.NOTION_TOKEN || !env.NOTION_DATA_SOURCE_ID) return [];
	const notion = getNotion(env);

	try {
		const res = await notion.dataSources.query({
			data_source_id: env.NOTION_DATA_SOURCE_ID,
		});

		return (res.results as PageObjectResponse[])
			.map((page) => mapPost(page))
			.filter((post) => post.status === "公開済み")
			.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);
	} catch {
		return [];
	}
}

// スラッグで記事を検索し、公開済みのものだけを返す。見つからない・非公開の場合はnull。
export async function getPostBySlug(
	env: NotionEnv,
	slug: string,
): Promise<Post | null> {
	if (!env.NOTION_TOKEN || !env.NOTION_DATA_SOURCE_ID) return null;
	const notion = getNotion(env);

	try {
		const res = await notion.dataSources.query({
			data_source_id: env.NOTION_DATA_SOURCE_ID,
			filter: {
				property: "Slug",
				rich_text: {
					equals: slug,
				},
			},
		});

		const page = res.results[0] as PageObjectResponse | undefined;
		if (!page) return null;
		const post = mapPost(page);
		if (post.status !== "公開済み") return null;
		return post;
	} catch {
		return null;
	}
}

// NotionページIDに紐づく子ブロック一覧を取得する。
export async function getBlocks(env: NotionEnv, pageId: string) {
	const notion = getNotion(env);

	const res = await notion.blocks.children.list({
		block_id: pageId,
	});

	return res.results;
}

// NotionページをNotionConverterでマークダウンに変換して返す。
export async function getPostMarkdown(env: NotionEnv, pageId: string) {
	const notion = getNotion(env);
	const n2m = new NotionConverter(notion);

	const result = await n2m.convert(pageId);

	return result.content;
}
