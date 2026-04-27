/**
 * テストページに Notion API でサポートされる主要ブロック種別を投入するスクリプト。
 *
 * 既存の子ブロックは全て archive (=削除) してから、新しい構成で `blocks.children.append` する。
 *
 * 使い方:
 *   NOTION_TOKEN=xxx pnpm seed
 *   または NOTION_TEST_PAGE_ID=<page-uuid> で対象ページを上書き指定
 *
 * 注意:
 * - `link_preview` ブロックは Notion 公式 API では作成不可 (Notion UI でしか追加できない)。
 *   そのため本スクリプトでは段落内のハイパーリンクで代替する。
 * - `synced_block` の original / `child_page` / `child_database` / `breadcrumb` 等、
 *   API で append しても期待通り動かないブロックは投入対象から除外している。
 */

import "dotenv/config";

import { Client } from "@notionhq/client";
import { postsDataSourceId } from "../src/generated/nhc.js";

const TOKEN = process.env.NOTION_TOKEN;
if (!TOKEN) {
	throw new Error("NOTION_TOKEN env が設定されていません。");
}

const client = new Client({ auth: TOKEN });

const YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const SAMPLE_BOOKMARK_URL = "https://github.com";
const SAMPLE_EMBED_URL = "https://codepen.io/chriscoyier/pen/MWLEMOY";
const SAMPLE_IMAGE_URL =
	"https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?w=1200";
const SAMPLE_VIDEO_URL = "https://www.w3schools.com/html/mov_bbb.mp4";
const SAMPLE_PDF_URL =
	"https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

async function resolveTestPageId(): Promise<string> {
	if (process.env.NOTION_TEST_PAGE_ID) {
		return process.env.NOTION_TEST_PAGE_ID;
	}
	// Slug が "test" のページを優先。なければ DB の先頭ページを使う。
	const res = await client.dataSources.query({
		data_source_id: postsDataSourceId,
		page_size: 50,
	});
	for (const page of res.results) {
		if (page.object !== "page") continue;
		// biome-ignore lint/suspicious/noExplicitAny: page.properties は API 型が広いため any で受ける
		const props = (page as any).properties ?? {};
		const slug =
			// biome-ignore lint/suspicious/noExplicitAny: rich_text の plain_text 抽出
			props.Slug?.rich_text?.map((t: any) => t.plain_text).join("") ?? "";
		if (slug === "test" || slug === "test-blocks") {
			return page.id;
		}
	}
	const first = res.results[0];
	if (!first) {
		throw new Error(
			`データソース ${postsDataSourceId} にページが 1 件もありません。NOTION_TEST_PAGE_ID を指定してください。`,
		);
	}
	return first.id;
}

async function clearChildren(pageId: string): Promise<void> {
	let cursor: string | undefined;
	let total = 0;
	do {
		const res = await client.blocks.children.list({
			block_id: pageId,
			start_cursor: cursor,
			page_size: 100,
		});
		for (const block of res.results) {
			try {
				await client.blocks.delete({ block_id: block.id });
				total++;
			} catch (err) {
				console.warn(
					`既存ブロック ${block.id} の削除に失敗しました:`,
					(err as Error).message,
				);
			}
		}
		cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
	} while (cursor);
	console.log(`既存ブロック ${total} 件を archive しました。`);
}

// biome-ignore lint/suspicious/noExplicitAny: Notion API のブロック型は union が大きいため any で構築する
type Block = any;

function paragraph(text: string): Block {
	return {
		object: "block",
		type: "paragraph",
		paragraph: {
			rich_text: [{ type: "text", text: { content: text } }],
		},
	};
}

function heading(level: 1 | 2 | 3, text: string): Block {
	const key = `heading_${level}` as const;
	return {
		object: "block",
		type: key,
		[key]: {
			rich_text: [{ type: "text", text: { content: text } }],
			color: "default",
			is_toggleable: false,
		},
	};
}

function buildBlocks(): Block[] {
	return [
		heading(1, "テストページ: ブロック種別ショーケース"),
		paragraph(
			"このページは notion-embed の HTML レンダリングを検証するため、Notion API でサポートされる主要なブロック型を網羅的に並べたものです。",
		),

		heading(2, "テキスト系"),
		{
			object: "block",
			type: "paragraph",
			paragraph: {
				rich_text: [
					{ type: "text", text: { content: "通常テキスト / " } },
					{
						type: "text",
						text: { content: "太字" },
						annotations: { bold: true },
					},
					{ type: "text", text: { content: " / " } },
					{
						type: "text",
						text: { content: "斜体" },
						annotations: { italic: true },
					},
					{ type: "text", text: { content: " / " } },
					{
						type: "text",
						text: { content: "下線" },
						annotations: { underline: true },
					},
					{ type: "text", text: { content: " / " } },
					{
						type: "text",
						text: { content: "取消線" },
						annotations: { strikethrough: true },
					},
					{ type: "text", text: { content: " / " } },
					{
						type: "text",
						text: { content: "コード" },
						annotations: { code: true },
					},
					{ type: "text", text: { content: " / " } },
					{
						type: "text",
						text: {
							content: "リンク",
							link: { url: "https://www.notion.so" },
						},
					},
					{ type: "text", text: { content: " を含む段落。" } },
				],
			},
		},

		heading(2, "見出し"),
		heading(1, "見出し 1"),
		heading(2, "見出し 2"),
		heading(3, "見出し 3"),

		heading(2, "リスト"),
		{
			object: "block",
			type: "bulleted_list_item",
			bulleted_list_item: {
				rich_text: [{ type: "text", text: { content: "箇条書き 1" } }],
			},
		},
		{
			object: "block",
			type: "bulleted_list_item",
			bulleted_list_item: {
				rich_text: [{ type: "text", text: { content: "箇条書き 2" } }],
			},
		},
		{
			object: "block",
			type: "numbered_list_item",
			numbered_list_item: {
				rich_text: [{ type: "text", text: { content: "番号付き 1" } }],
			},
		},
		{
			object: "block",
			type: "numbered_list_item",
			numbered_list_item: {
				rich_text: [{ type: "text", text: { content: "番号付き 2" } }],
			},
		},
		{
			object: "block",
			type: "to_do",
			to_do: {
				rich_text: [{ type: "text", text: { content: "未完了タスク" } }],
				checked: false,
			},
		},
		{
			object: "block",
			type: "to_do",
			to_do: {
				rich_text: [{ type: "text", text: { content: "完了タスク" } }],
				checked: true,
			},
		},

		heading(2, "ブロック装飾"),
		{
			object: "block",
			type: "quote",
			quote: {
				rich_text: [
					{ type: "text", text: { content: "引用ブロックのサンプル。" } },
				],
			},
		},
		{
			object: "block",
			type: "callout",
			callout: {
				rich_text: [
					{
						type: "text",
						text: {
							content: "これはコールアウトです。重要な注意事項を強調できます。",
						},
					},
				],
				icon: { type: "emoji", emoji: "💡" },
				color: "yellow_background",
			},
		},
		{
			object: "block",
			type: "code",
			code: {
				rich_text: [
					{
						type: "text",
						text: {
							content:
								"export function greet(name: string): string {\n\treturn `Hello, ${name}!`;\n}",
						},
					},
				],
				language: "typescript",
			},
		},

		heading(2, "区切り / 目次"),
		{ object: "block", type: "divider", divider: {} },
		{
			object: "block",
			type: "table_of_contents",
			table_of_contents: { color: "default" },
		},

		heading(2, "折りたたみ"),
		{
			object: "block",
			type: "toggle",
			toggle: {
				rich_text: [{ type: "text", text: { content: "クリックで開く" } }],
				children: [paragraph("折りたたみ内のテキスト。")],
			},
		},

		heading(2, "数式"),
		{
			object: "block",
			type: "equation",
			equation: { expression: "E = mc^2" },
		},

		heading(2, "テーブル"),
		{
			object: "block",
			type: "table",
			table: {
				table_width: 3,
				has_column_header: true,
				has_row_header: false,
				children: [
					{
						object: "block",
						type: "table_row",
						table_row: {
							cells: [
								[{ type: "text", text: { content: "列 A" } }],
								[{ type: "text", text: { content: "列 B" } }],
								[{ type: "text", text: { content: "列 C" } }],
							],
						},
					},
					{
						object: "block",
						type: "table_row",
						table_row: {
							cells: [
								[{ type: "text", text: { content: "1-A" } }],
								[{ type: "text", text: { content: "1-B" } }],
								[{ type: "text", text: { content: "1-C" } }],
							],
						},
					},
					{
						object: "block",
						type: "table_row",
						table_row: {
							cells: [
								[{ type: "text", text: { content: "2-A" } }],
								[{ type: "text", text: { content: "2-B" } }],
								[{ type: "text", text: { content: "2-C" } }],
							],
						},
					},
				],
			},
		},

		heading(2, "メディア"),
		{
			object: "block",
			type: "image",
			image: {
				type: "external",
				external: { url: SAMPLE_IMAGE_URL },
				caption: [
					{ type: "text", text: { content: "外部 URL の画像サンプル" } },
				],
			},
		},
		{
			object: "block",
			type: "video",
			video: {
				type: "external",
				external: { url: SAMPLE_VIDEO_URL },
				caption: [{ type: "text", text: { content: "MP4 動画サンプル" } }],
			},
		},
		{
			object: "block",
			type: "pdf",
			pdf: {
				type: "external",
				external: { url: SAMPLE_PDF_URL },
				caption: [{ type: "text", text: { content: "PDF サンプル" } }],
			},
		},

		heading(2, "汎用 bookmark / embed"),
		{
			object: "block",
			type: "bookmark",
			bookmark: {
				url: SAMPLE_BOOKMARK_URL,
				caption: [{ type: "text", text: { content: "GitHub のブックマーク" } }],
			},
		},
		{
			object: "block",
			type: "embed",
			embed: {
				url: SAMPLE_EMBED_URL,
				caption: [{ type: "text", text: { content: "CodePen 埋め込み" } }],
			},
		},

		heading(2, "YouTube 3 連 (本題)"),
		paragraph(
			"以下の 3 つのブロックは、Notion 上で同じ YouTube URL を 3 通りの方法で貼り付けたもの相当です。期待: カード → テキスト → カード。",
		),
		{
			object: "block",
			type: "bookmark",
			bookmark: {
				url: YOUTUBE_URL,
				caption: [
					{ type: "text", text: { content: "YouTube bookmark (上のカード)" } },
				],
			},
		},
		{
			// link_preview は API で作成不可。代わりに段落内ハイパーリンクで「中段の文字」を代用する。
			object: "block",
			type: "paragraph",
			paragraph: {
				rich_text: [
					{
						type: "text",
						text: {
							content: "YouTube メンション (link_preview 代替): ",
						},
					},
					{
						type: "text",
						text: {
							content: "Rick Astley - Never Gonna Give You Up",
							link: { url: YOUTUBE_URL },
						},
					},
				],
			},
		},
		{
			object: "block",
			type: "embed",
			embed: {
				url: YOUTUBE_URL,
				caption: [
					{ type: "text", text: { content: "YouTube embed (下のカード)" } },
				],
			},
		},
	];
}

async function appendInChunks(
	pageId: string,
	blocks: Block[],
): Promise<number> {
	// children.append は 1 回 100 件まで
	const CHUNK = 100;
	let total = 0;
	for (let i = 0; i < blocks.length; i += CHUNK) {
		const slice = blocks.slice(i, i + CHUNK);
		const res = await client.blocks.children.append({
			block_id: pageId,
			children: slice,
		});
		total += res.results.length;
	}
	return total;
}

async function main(): Promise<void> {
	const pageId = await resolveTestPageId();
	console.log(`対象ページ: ${pageId}`);
	if (process.env.SKIP_CLEAR !== "1") {
		await clearChildren(pageId);
	} else {
		console.log("SKIP_CLEAR=1 のため既存ブロック削除をスキップします。");
	}
	const blocks = buildBlocks();
	console.log(`新ブロック ${blocks.length} 件を append します...`);
	const appended = await appendInChunks(pageId, blocks);
	console.log(`append 完了: ${appended} 件`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
