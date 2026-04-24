import type { PropertyMap } from "@notion-headless-cms/core";
import { describe, expect, it } from "vitest";
import { mapItemFromPropertyMap } from "../mapper";

const makePage = (properties: Record<string, unknown>) => ({
	id: "page-id",
	last_edited_time: "2024-01-01T00:00:00.000Z",
	created_time: "2024-01-01T00:00:00.000Z",
	properties,
});

describe("mapItemFromPropertyMap", () => {
	it("id と updatedAt が設定される", () => {
		const page = makePage({
			Name: { type: "title", title: [{ plain_text: "Test" }] },
		});
		const properties: PropertyMap = {
			name: { type: "title", notion: "Name" },
		};
		const item = mapItemFromPropertyMap(page as never, properties);
		expect(item.id).toBe("page-id");
		expect(item.updatedAt).toBe("2024-01-01T00:00:00.000Z");
	});

	it("title プロパティが title フィールドに反映される", () => {
		const page = makePage({
			Name: { type: "title", title: [{ plain_text: "Hello" }] },
		});
		const properties: PropertyMap = {
			name: { type: "title", notion: "Name" },
		};
		const item = mapItemFromPropertyMap(page as never, properties);
		expect(item.title).toBe("Hello");
	});

	it("title 型プロパティがない場合は title が null になる", () => {
		const page = makePage({
			Slug: { type: "rich_text", rich_text: [{ plain_text: "my-slug" }] },
		});
		const properties: PropertyMap = {
			slug: { type: "richText", notion: "Slug" },
		};
		const item = mapItemFromPropertyMap(page as never, properties);
		expect(item.title).toBeNull();
	});

	it("richText プロパティが文字列として取得される", () => {
		const page = makePage({
			Name: { type: "title", title: [] },
			Slug: { type: "rich_text", rich_text: [{ plain_text: "my-slug" }] },
		});
		const properties: PropertyMap = {
			name: { type: "title", notion: "Name" },
			slug: { type: "richText", notion: "Slug" },
		};
		const result = mapItemFromPropertyMap(
			page as never,
			properties,
		) as unknown as Record<string, unknown>;
		expect(result.slug).toBe("my-slug");
	});

	it("select プロパティが文字列として取得される", () => {
		const page = makePage({
			Name: { type: "title", title: [] },
			Status: { type: "select", select: { name: "公開" } },
		});
		const properties: PropertyMap = {
			name: { type: "title", notion: "Name" },
			status: { type: "select", notion: "Status" },
		};
		const result = mapItemFromPropertyMap(
			page as never,
			properties,
		) as unknown as Record<string, unknown>;
		expect(result.status).toBe("公開");
	});

	it("status プロパティが select と同様に取得される", () => {
		const page = makePage({
			Name: { type: "title", title: [] },
			Status: { type: "status", status: { name: "下書き" } },
		});
		const properties: PropertyMap = {
			name: { type: "title", notion: "Name" },
			status: { type: "select", notion: "Status" },
		};
		const result = mapItemFromPropertyMap(
			page as never,
			properties,
		) as unknown as Record<string, unknown>;
		expect(result.status).toBe("下書き");
	});

	it("multiSelect プロパティが文字列配列として取得される", () => {
		const page = makePage({
			Name: { type: "title", title: [] },
			Tags: {
				type: "multi_select",
				multi_select: [{ name: "A" }, { name: "B" }],
			},
		});
		const properties: PropertyMap = {
			name: { type: "title", notion: "Name" },
			tags: { type: "multiSelect", notion: "Tags" },
		};
		const result = mapItemFromPropertyMap(
			page as never,
			properties,
		) as unknown as Record<string, unknown>;
		expect(result.tags).toEqual(["A", "B"]);
	});

	it("date プロパティが start 日付文字列として取得される", () => {
		const page = makePage({
			Name: { type: "title", title: [] },
			PublishedAt: { type: "date", date: { start: "2024-06-01" } },
		});
		const properties: PropertyMap = {
			name: { type: "title", notion: "Name" },
			publishedAt: { type: "date", notion: "PublishedAt" },
		};
		const result = mapItemFromPropertyMap(
			page as never,
			properties,
		) as unknown as Record<string, unknown>;
		expect(result.publishedAt).toBe("2024-06-01");
	});

	it("number プロパティが数値として取得される", () => {
		const page = makePage({
			Name: { type: "title", title: [] },
			Views: { type: "number", number: 42 },
		});
		const properties: PropertyMap = {
			name: { type: "title", notion: "Name" },
			views: { type: "number", notion: "Views" },
		};
		const result = mapItemFromPropertyMap(
			page as never,
			properties,
		) as unknown as Record<string, unknown>;
		expect(result.views).toBe(42);
	});

	it("checkbox プロパティが boolean として取得される", () => {
		const page = makePage({
			Name: { type: "title", title: [] },
			Featured: { type: "checkbox", checkbox: true },
		});
		const properties: PropertyMap = {
			name: { type: "title", notion: "Name" },
			featured: { type: "checkbox", notion: "Featured" },
		};
		const result = mapItemFromPropertyMap(
			page as never,
			properties,
		) as unknown as Record<string, unknown>;
		expect(result.featured).toBe(true);
	});

	it("url プロパティが文字列として取得される", () => {
		const page = makePage({
			Name: { type: "title", title: [] },
			Link: { type: "url", url: "https://example.com" },
		});
		const properties: PropertyMap = {
			name: { type: "title", notion: "Name" },
			link: { type: "url", notion: "Link" },
		};
		const result = mapItemFromPropertyMap(
			page as never,
			properties,
		) as unknown as Record<string, unknown>;
		expect(result.link).toBe("https://example.com");
	});

	it("プロパティが存在しない場合のデフォルト値（null/false/[]）", () => {
		const page = makePage({
			Name: { type: "title", title: [] },
		});
		const properties: PropertyMap = {
			name: { type: "title", notion: "Name" },
			text: { type: "richText", notion: "Missing" },
			tags: { type: "multiSelect", notion: "MissingTags" },
			featured: { type: "checkbox", notion: "MissingCheckbox" },
		};
		const result = mapItemFromPropertyMap(
			page as never,
			properties,
		) as unknown as Record<string, unknown>;
		expect(result.text).toBeNull();
		expect(result.tags).toEqual([]);
		expect(result.featured).toBe(false);
	});
});
