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
	status: { type: "status", notion: "Status" },
	title: { type: "title", notion: "Title" },
	tags: { type: "multiSelect", notion: "Tags" },
	views: { type: "number", notion: "Views" },
});

describe("defineMapping", () => {
	it("受け取ったオブジェクトをそのまま返す（恒等関数）", () => {
		expect(mapping.slug).toEqual({ type: "richText", notion: "Slug" });
		expect(mapping.status).toEqual({ type: "status", notion: "Status" });
	});
});

describe("defineSchema", () => {
	const schema = defineSchema(PostSchema, mapping);

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

		it("mapping に title がなくてもページタイトルを自動セットする", () => {
			const NoTitleSchema = z.object({
				id: z.string(),
				updatedAt: z.string(),
				title: z.string().nullable().optional(),
				slug: z.string().nullable(),
			});
			const noTitleMapping = defineMapping<z.infer<typeof NoTitleSchema>>({
				slug: { type: "richText", notion: "Slug" },
			});
			const noTitleSchema = defineSchema(NoTitleSchema, noTitleMapping);
			const page = makePage({
				Name: { type: "title", title: [{ plain_text: "Auto Title" }] },
				Slug: { type: "rich_text", rich_text: [{ plain_text: "auto" }] },
			});
			const item = noTitleSchema.mapItem(page as never);
			expect(item.title).toBe("Auto Title");
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
				status: { type: "status", notion: "Status" },
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

		it("url フィールドタイプをパースする", () => {
			const UrlSchema = z.object({
				id: z.string(),
				updatedAt: z.string(),
				title: z.string().nullable(),
				link: z.string().nullable(),
			});
			const urlMapping = defineMapping<z.infer<typeof UrlSchema>>({
				title: { type: "title", notion: "Name" },
				link: { type: "url", notion: "Link" },
			});
			const urlSchema = defineSchema(UrlSchema, urlMapping);
			const page = makePage({
				Name: { type: "title", title: [] },
				Link: { type: "url", url: "https://example.com" },
			});
			const item = urlSchema.mapItem(page as never);
			expect(item.link).toBe("https://example.com");
		});

		it("url フィールドで型が一致しない場合は null を返す", () => {
			const UrlSchema = z.object({
				id: z.string(),
				updatedAt: z.string(),
				title: z.string().nullable(),
				link: z.string().nullable(),
			});
			const urlMapping = defineMapping<z.infer<typeof UrlSchema>>({
				title: { type: "title", notion: "Name" },
				link: { type: "url", notion: "Link" },
			});
			const urlSchema = defineSchema(UrlSchema, urlMapping);
			const page = makePage({
				Name: { type: "title", title: [] },
				Link: { type: "rich_text", rich_text: [{ plain_text: "not a url" }] },
			});
			const item = urlSchema.mapItem(page as never);
			expect(item.link).toBeNull();
		});

		it("checkbox フィールドで型が一致しない場合は false を返す", () => {
			const CheckSchema = z.object({
				id: z.string(),
				updatedAt: z.string(),
				title: z.string().nullable(),
				active: z.boolean(),
			});
			const checkMapping = defineMapping<z.infer<typeof CheckSchema>>({
				title: { type: "title", notion: "Name" },
				active: { type: "checkbox", notion: "Active" },
			});
			const checkSchema = defineSchema(CheckSchema, checkMapping);
			const page = makePage({
				Name: { type: "title", title: [] },
				// Active を rich_text にすることで型ミスマッチを起こす
				Active: { type: "rich_text", rich_text: [] },
			});
			const item = checkSchema.mapItem(page as never);
			expect(item.active).toBe(false);
		});

		it("date フィールドで型が一致しない場合は null を返す", () => {
			const DateSchema = z.object({
				id: z.string(),
				updatedAt: z.string(),
				title: z.string().nullable(),
				publishedAt: z.string().nullable(),
			});
			const dateMapping = defineMapping<z.infer<typeof DateSchema>>({
				title: { type: "title", notion: "Name" },
				publishedAt: { type: "date", notion: "PublishedAt" },
			});
			const dateSchema = defineSchema(DateSchema, dateMapping);
			const page = makePage({
				Name: { type: "title", title: [] },
				PublishedAt: {
					type: "rich_text",
					rich_text: [{ plain_text: "not a date" }],
				},
			});
			const item = dateSchema.mapItem(page as never);
			expect(item.publishedAt).toBeNull();
		});

		it("status フィールドで status プロパティが null の場合は null を返す", () => {
			const StatusNullMatchSchema = z.object({
				id: z.string(),
				updatedAt: z.string(),
				title: z.string().nullable(),
				state: z.string().nullable(),
			});
			const statusNullMatchMapping = defineMapping<
				z.infer<typeof StatusNullMatchSchema>
			>({
				title: { type: "title", notion: "Name" },
				state: { type: "status", notion: "State" },
			});
			const statusNullMatchSchema = defineSchema(
				StatusNullMatchSchema,
				statusNullMatchMapping,
			);
			const page = makePage({
				Name: { type: "title", title: [] },
				State: { type: "status", status: null },
			});
			const item = statusNullMatchSchema.mapItem(page as never);
			expect(item.state).toBeNull();
		});

		it("status フィールドで型が一致しない場合は null を返す", () => {
			const StatusMismatchSchema = z.object({
				id: z.string(),
				updatedAt: z.string(),
				title: z.string().nullable(),
				state: z.string().nullable(),
			});
			const statusMismatchMapping = defineMapping<
				z.infer<typeof StatusMismatchSchema>
			>({
				title: { type: "title", notion: "Name" },
				state: { type: "status", notion: "State" },
			});
			const statusMismatchSchema = defineSchema(
				StatusMismatchSchema,
				statusMismatchMapping,
			);
			const page = makePage({
				Name: { type: "title", title: [] },
				State: { type: "rich_text", rich_text: [{ plain_text: "not-status" }] },
			});
			const item = statusMismatchSchema.mapItem(page as never);
			expect(item.state).toBeNull();
		});

		it("select フィールドで prop が select でも status でもない場合は null を返す", () => {
			const SelectSchema = z.object({
				id: z.string(),
				updatedAt: z.string(),
				title: z.string().nullable(),
				category: z.string().nullable(),
			});
			const selectMapping = defineMapping<z.infer<typeof SelectSchema>>({
				title: { type: "title", notion: "Name" },
				category: { type: "select", notion: "Category" },
			});
			const selectSchema = defineSchema(SelectSchema, selectMapping);
			const page = makePage({
				Name: { type: "title", title: [] },
				Category: { type: "rich_text", rich_text: [{ plain_text: "misc" }] },
			});
			const item = selectSchema.mapItem(page as never);
			expect(item.category).toBeNull();
		});

		it("プロパティが undefined の場合の各型デフォルト値", () => {
			const AllTypesSchema = z.object({
				id: z.string(),
				updatedAt: z.string(),
				title: z.string().nullable(),
				check: z.boolean(),
				tags: z.array(z.string()),
				name: z.string().nullable(),
			});
			const allTypesMapping = defineMapping<z.infer<typeof AllTypesSchema>>({
				title: { type: "title", notion: "Name" },
				check: { type: "checkbox", notion: "MissingCheck" },
				tags: { type: "multiSelect", notion: "MissingTags" },
				name: { type: "richText", notion: "MissingName" },
			});
			const allTypesSchema = defineSchema(AllTypesSchema, allTypesMapping);
			const page = makePage({
				Name: { type: "title", title: [] },
				// MissingCheck, MissingTags, MissingName は存在しない
			});
			const item = allTypesSchema.mapItem(page as never);
			expect(item.check).toBe(false);
			expect(item.tags).toEqual([]);
			expect(item.name).toBeNull();
		});

		it("title フィールドで型が一致しない場合は null を返す", () => {
			const TitleSchema = z.object({
				id: z.string(),
				updatedAt: z.string(),
				title: z.string().nullable(),
				name: z.string().nullable(),
			});
			const titleMapping = defineMapping<z.infer<typeof TitleSchema>>({
				title: { type: "title", notion: "Title" },
				name: { type: "title", notion: "Name" },
			});
			const titleSchema = defineSchema(TitleSchema, titleMapping);
			const page = makePage({
				Name: { type: "rich_text", rich_text: [{ plain_text: "not title" }] },
			});
			const item = titleSchema.mapItem(page as never);
			expect(item.name).toBeNull();
		});

		it("richText フィールドで型が一致しない場合は null を返す", () => {
			const RichTextSchema = z.object({
				id: z.string(),
				updatedAt: z.string(),
				title: z.string().nullable(),
				desc: z.string().nullable(),
			});
			const richTextMapping = defineMapping<z.infer<typeof RichTextSchema>>({
				title: { type: "title", notion: "Name" },
				desc: { type: "richText", notion: "Desc" },
			});
			const richTextSchema = defineSchema(RichTextSchema, richTextMapping);
			const page = makePage({
				Name: { type: "title", title: [] },
				Desc: { type: "number", number: 42 },
			});
			const item = richTextSchema.mapItem(page as never);
			expect(item.desc).toBeNull();
		});

		it("number フィールドで型が一致しない場合は null を返す", () => {
			const NumSchema = z.object({
				id: z.string(),
				updatedAt: z.string(),
				title: z.string().nullable(),
				count: z.number().nullable(),
			});
			const numMapping = defineMapping<z.infer<typeof NumSchema>>({
				title: { type: "title", notion: "Name" },
				count: { type: "number", notion: "Count" },
			});
			const numSchema = defineSchema(NumSchema, numMapping);
			const page = makePage({
				Name: { type: "title", title: [] },
				Count: { type: "rich_text", rich_text: [] },
			});
			const item = numSchema.mapItem(page as never);
			expect(item.count).toBeNull();
		});

		it("multiSelect フィールドで型が一致しない場合は空配列を返す", () => {
			const MsSchema = z.object({
				id: z.string(),
				updatedAt: z.string(),
				title: z.string().nullable(),
				labels: z.array(z.string()),
			});
			const msMapping = defineMapping<z.infer<typeof MsSchema>>({
				title: { type: "title", notion: "Name" },
				labels: { type: "multiSelect", notion: "Labels" },
			});
			const msSchema = defineSchema(MsSchema, msMapping);
			const page = makePage({
				Name: { type: "title", title: [] },
				Labels: { type: "rich_text", rich_text: [] },
			});
			const item = msSchema.mapItem(page as never);
			expect(item.labels).toEqual([]);
		});

		it("select フィールドで select.name が null の場合は null を返す", () => {
			const SelectNullSchema = z.object({
				id: z.string(),
				updatedAt: z.string(),
				title: z.string().nullable(),
				category: z.string().nullable(),
			});
			const selectNullMapping = defineMapping<z.infer<typeof SelectNullSchema>>(
				{
					title: { type: "title", notion: "Name" },
					category: { type: "select", notion: "Category" },
				},
			);
			const selectNullSchema = defineSchema(
				SelectNullSchema,
				selectNullMapping,
			);
			const page = makePage({
				Name: { type: "title", title: [] },
				Category: { type: "select", select: null },
			});
			const item = selectNullSchema.mapItem(page as never);
			expect(item.category).toBeNull();
		});

		it("date フィールドで date プロパティがある場合は start を返す", () => {
			const DateMatchSchema = z.object({
				id: z.string(),
				updatedAt: z.string(),
				title: z.string().nullable(),
				publishedAt: z.string().nullable(),
			});
			const dateMatchMapping = defineMapping<z.infer<typeof DateMatchSchema>>({
				title: { type: "title", notion: "Name" },
				publishedAt: { type: "date", notion: "PublishedAt" },
			});
			const dateMatchSchema = defineSchema(DateMatchSchema, dateMatchMapping);
			const page = makePage({
				Name: { type: "title", title: [] },
				PublishedAt: { type: "date", date: { start: "2024-06-01" } },
			});
			const item = dateMatchSchema.mapItem(page as never);
			expect(item.publishedAt).toBe("2024-06-01");
		});

		it("date フィールドで date が null の場合は null を返す", () => {
			const DateNullSchema = z.object({
				id: z.string(),
				updatedAt: z.string(),
				title: z.string().nullable(),
				publishedAt: z.string().nullable(),
			});
			const dateNullMapping = defineMapping<z.infer<typeof DateNullSchema>>({
				title: { type: "title", notion: "Name" },
				publishedAt: { type: "date", notion: "PublishedAt" },
			});
			const dateNullSchema = defineSchema(DateNullSchema, dateNullMapping);
			const page = makePage({
				Name: { type: "title", title: [] },
				PublishedAt: { type: "date", date: null },
			});
			const item = dateNullSchema.mapItem(page as never);
			expect(item.publishedAt).toBeNull();
		});

		it("checkbox フィールドで checkbox プロパティがある場合は boolean を返す", () => {
			const CheckMatchSchema = z.object({
				id: z.string(),
				updatedAt: z.string(),
				title: z.string().nullable(),
				active: z.boolean(),
			});
			const checkMatchMapping = defineMapping<z.infer<typeof CheckMatchSchema>>(
				{
					title: { type: "title", notion: "Name" },
					active: { type: "checkbox", notion: "Active" },
				},
			);
			const checkMatchSchema = defineSchema(
				CheckMatchSchema,
				checkMatchMapping,
			);
			const page = makePage({
				Name: { type: "title", title: [] },
				Active: { type: "checkbox", checkbox: true },
			});
			const item = checkMatchSchema.mapItem(page as never);
			expect(item.active).toBe(true);
		});

		it("status プロパティが null の場合は null を返す", () => {
			const StatusNullSchema = z.object({
				id: z.string(),
				updatedAt: z.string(),
				title: z.string().nullable(),
				category: z.string().nullable(),
			});
			const statusNullMapping = defineMapping<z.infer<typeof StatusNullSchema>>(
				{
					title: { type: "title", notion: "Name" },
					category: { type: "select", notion: "Category" },
				},
			);
			const statusNullSchema = defineSchema(
				StatusNullSchema,
				statusNullMapping,
			);
			const page = makePage({
				Name: { type: "title", title: [] },
				Category: { type: "status", status: null },
			});
			const item = statusNullSchema.mapItem(page as never);
			expect(item.category).toBeNull();
		});

		it("SYSTEM_FIELDS (id, updatedAt) はマッピングでスキップされる", () => {
			const SysSchema = z.object({
				id: z.string(),
				updatedAt: z.string(),
				title: z.string().nullable(),
				slug: z.string().nullable(),
			});
			const sysMapping = defineMapping<z.infer<typeof SysSchema>>({
				title: { type: "title", notion: "Name" },
				slug: { type: "richText", notion: "Slug" },
			});
			const sysSchema = defineSchema(SysSchema, sysMapping);
			const page = makePage({
				Name: { type: "title", title: [] },
				Slug: { type: "rich_text", rich_text: [{ plain_text: "my-slug" }] },
			});
			const item = sysSchema.mapItem(page as never);
			// システムフィールドはページメタデータから取得される
			expect(item.id).toBe("page-id-123");
			expect(item.slug).toBe("my-slug");
		});
	});
});
