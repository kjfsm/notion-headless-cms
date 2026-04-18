import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { describe, expect, it } from "vitest";
import { NotionHeadlessCMSError } from "../errors";
import { getPlainText, mapItem } from "../mapper";
import type { CMSSchemaProperties } from "../types";

const makeRichText = (text: string) => [{ plain_text: text }];

const defaultProps: Required<CMSSchemaProperties> = {
	title: "Title",
	slug: "Slug",
	status: "Status",
	author: "Author",
	date: "CreatedAt",
};

const makePage = (
	propertyOverrides: Record<string, unknown> = {},
): PageObjectResponse =>
	({
		id: "page-id-123",
		created_time: "2024-01-01T00:00:00.000Z",
		last_edited_time: "2024-06-01T00:00:00.000Z",
		properties: {
			Title: { title: makeRichText("テスト記事") },
			Slug: { rich_text: makeRichText("test-article") },
			Status: { status: { name: "Published" } },
			Author: { rich_text: makeRichText("テスト著者") },
			CreatedAt: { date: { start: "2024-01-01" } },
			...propertyOverrides,
		},
	}) as unknown as PageObjectResponse;

describe("getPlainText", () => {
	it("undefined を渡すと空文字を返す", () => {
		expect(getPlainText(undefined)).toBe("");
	});

	it("空配列を渡すと空文字を返す", () => {
		expect(getPlainText([])).toBe("");
	});

	it("単一要素のテキストを返す", () => {
		// biome-ignore lint/suspicious/noExplicitAny: テスト用モック
		const items = [{ plain_text: "Hello" }] as any;
		expect(getPlainText(items)).toBe("Hello");
	});

	it("複数要素を結合して返す", () => {
		// biome-ignore lint/suspicious/noExplicitAny: テスト用モック
		const items = [{ plain_text: "Hello" }, { plain_text: " World" }] as any;
		expect(getPlainText(items)).toBe("Hello World");
	});
});

describe("mapItem", () => {
	it("正常なページを ContentItem に変換する", () => {
		const result = mapItem(makePage(), defaultProps);
		expect(result).toEqual({
			id: "page-id-123",
			title: "テスト記事",
			slug: "test-article",
			status: "Published",
			publishedAt: "2024-01-01",
			author: "テスト著者",
			updatedAt: "2024-06-01T00:00:00.000Z",
		});
	});

	it("date プロパティが null の場合は created_time を publishedAt に使う", () => {
		const page = makePage({ CreatedAt: { date: null } });
		const result = mapItem(page, defaultProps);
		expect(result.publishedAt).toBe("2024-01-01T00:00:00.000Z");
	});

	it("Status が select 型でも正しく取得する", () => {
		const page = makePage({ Status: { select: { name: "Draft" } } });
		const result = mapItem(page, defaultProps);
		expect(result.status).toBe("Draft");
	});

	it("Author が people 型でも正しく取得する", () => {
		const page = makePage({
			Author: { people: [{ id: "u1", name: "山田太郎" }] },
		});
		const result = mapItem(page, defaultProps);
		expect(result.author).toBe("山田太郎");
	});

	it("Author が複数の people の場合はカンマ区切りで結合する", () => {
		const page = makePage({
			Author: {
				people: [
					{ id: "u1", name: "山田太郎" },
					{ id: "u2", name: "佐藤花子" },
				],
			},
		});
		const result = mapItem(page, defaultProps);
		expect(result.author).toBe("山田太郎, 佐藤花子");
	});

	it("id が空文字の場合は NotionHeadlessCMSError をスローする", () => {
		const page = { ...makePage(), id: "" };
		expect(() => mapItem(page, defaultProps)).toThrow(NotionHeadlessCMSError);
	});

	it("スローされるエラーのコードは NOTION_ITEM_SCHEMA_INVALID", () => {
		const page = { ...makePage(), id: "" };
		expect(() => mapItem(page, defaultProps)).toThrow(
			expect.objectContaining({ code: "NOTION_ITEM_SCHEMA_INVALID" }),
		);
	});
});
