import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { describe, expect, it } from "vitest";
import { CMSError } from "../errors";
import { getPlainText, mapItem } from "../mapper";
import type { CMSSchemaProperties } from "../types";

const makeRichText = (text: string) => [{ plain_text: text }];

const defaultProps: Required<CMSSchemaProperties> = {
	slug: "Slug",
	status: "Status",
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
			Slug: { rich_text: makeRichText("test-article") },
			Status: { status: { name: "Published" } },
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
	it("正常なページを BaseContentItem に変換する", () => {
		const result = mapItem(makePage(), defaultProps);
		expect(result).toEqual({
			id: "page-id-123",
			slug: "test-article",
			status: "Published",
			publishedAt: "2024-01-01",
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

	it("id が空文字の場合は CMSError をスローする", () => {
		const page = { ...makePage(), id: "" };
		expect(() => mapItem(page, defaultProps)).toThrow(CMSError);
	});

	it("スローされるエラーのコードは NOTION_ITEM_SCHEMA_INVALID", () => {
		const page = { ...makePage(), id: "" };
		expect(() => mapItem(page, defaultProps)).toThrow(
			expect.objectContaining({ code: "NOTION_ITEM_SCHEMA_INVALID" }),
		);
	});
});
