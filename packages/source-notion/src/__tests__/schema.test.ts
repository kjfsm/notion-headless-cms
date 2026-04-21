import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineMapping, defineSchema } from "../schema";

// id と updatedAt は Notion ページメタデータから自動設定されるためマッピング不要
const PostSchema = z.object({
	id: z.string(),
	updatedAt: z.string(),
	slug: z.string().nullable(),
	status: z.string().nullable(),
	title: z.string().nullable(),
	tags: z.array(z.string()),
	views: z.number().nullable(),
});
type Post = z.infer<typeof PostSchema>;

const mapping = defineMapping<Post>({
	slug: { type: "richText", notion: "Slug" },
	status: {
		type: "select",
		notion: "Status",
		published: ["Published", "公開"],
	},
	title: { type: "title", notion: "Title" },
	tags: { type: "multiSelect", notion: "Tags" },
	views: { type: "number", notion: "Views" },
});

describe("defineMapping", () => {
	it("受け取ったオブジェクトをそのまま返す（恒等関数）", () => {
		expect(mapping.slug).toEqual({ type: "richText", notion: "Slug" });
		expect(mapping.status).toEqual({
			type: "select",
			notion: "Status",
			published: ["Published", "公開"],
		});
	});
});

describe("defineSchema", () => {
	const schema = defineSchema(PostSchema, mapping);

	it("publishedStatuses が select.published から抽出される", () => {
		expect(schema.publishedStatuses).toEqual(["Published", "公開"]);
	});

	it("accessibleStatuses が select.published からフォールバックされる", () => {
		expect(schema.accessibleStatuses).toEqual(["Published", "公開"]);
	});

	it("accessible を別途指定できる", () => {
		const m2 = defineMapping<Post>({
			...mapping,
			status: {
				type: "select",
				notion: "Status",
				published: ["Published"],
				accessible: ["Published", "Draft"],
			},
		});
		const s2 = defineSchema(PostSchema, m2);
		expect(s2.publishedStatuses).toEqual(["Published"]);
		expect(s2.accessibleStatuses).toEqual(["Published", "Draft"]);
	});

	it("mapping フィールドが保持される", () => {
		expect(schema.mapping).toBe(mapping);
	});

	describe("mapItem()", () => {
		const makePage = (props: Record<string, unknown>) => ({
			id: "page-id-123",
			last_edited_time: "2024-06-01T12:00:00.000Z",
			properties: props,
		});

		it("title プロパティをパースする", () => {
			const page = makePage({
				Title: {
					type: "title",
					title: [{ plain_text: "Hello World" }],
				},
				Slug: { type: "rich_text", rich_text: [{ plain_text: "hello-world" }] },
				Status: { type: "status", status: { name: "Published" } },
				Tags: { type: "multi_select", multi_select: [] },
				Views: { type: "number", number: 42 },
			});
			const item = schema.mapItem(page as never);
			expect(item.title).toBe("Hello World");
			expect(item.slug).toBe("hello-world");
			expect(item.status).toBe("Published");
			expect(item.views).toBe(42);
			// id と updatedAt は page メタデータから自動設定される
			expect(item.id).toBe("page-id-123");
			expect(item.updatedAt).toBe("2024-06-01T12:00:00.000Z");
		});

		it("multiSelect プロパティをパースする", () => {
			const page = makePage({
				Tags: {
					type: "multi_select",
					multi_select: [{ name: "ts" }, { name: "js" }],
				},
				Title: { type: "title", title: [] },
				Slug: { type: "rich_text", rich_text: [] },
				Status: { type: "status", status: { name: "Draft" } },
				Views: { type: "number", number: null },
			});
			const item = schema.mapItem(page as never);
			expect(item.tags).toEqual(["ts", "js"]);
		});

		it("プロパティ未定義時はデフォルト値", () => {
			const page = makePage({
				Title: { type: "title", title: [] },
				Slug: { type: "rich_text", rich_text: [] },
				Status: { type: "status", status: { name: "Draft" } },
				Tags: { type: "multi_select", multi_select: [] },
				Views: { type: "number", number: null },
			});
			const item = schema.mapItem(page as never);
			expect(item.tags).toEqual([]);
			expect(item.views).toBeNull();
			expect(item.title).toBeNull();
		});

		it("Zod バリデーションエラーでスローする", () => {
			const StrictSchema = z.object({
				id: z.string(),
				updatedAt: z.string(),
				slug: z.string(),
				status: z.string(),
				title: z.string(),
				tags: z.array(z.string()),
				views: z.number(),
			});
			const strictMapping = defineMapping<z.infer<typeof StrictSchema>>({
				slug: { type: "richText", notion: "Slug" },
				status: { type: "select", notion: "Status" },
				title: { type: "title", notion: "Title" },
				tags: { type: "multiSelect", notion: "Tags" },
				views: { type: "number", notion: "Views" },
			});
			const strictSchema = defineSchema(StrictSchema, strictMapping);
			// views が null なので z.number() バリデーション失敗
			const page = makePage({
				Title: { type: "title", title: [{ plain_text: "Hi" }] },
				Slug: { type: "rich_text", rich_text: [{ plain_text: "hi" }] },
				Status: { type: "status", status: { name: "Draft" } },
				Tags: { type: "multi_select", multi_select: [] },
				Views: { type: "number", number: null },
			});
			expect(() => strictSchema.mapItem(page as never)).toThrow();
		});
	});
});
