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
		type: "status",
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
			type: "status",
			notion: "Status",
			published: ["Published", "公開"],
		});
	});
});

describe("defineSchema", () => {
	const schema = defineSchema(PostSchema, mapping);

	it("publishedStatuses が status.published から抽出される", () => {
		expect(schema.publishedStatuses).toEqual(["Published", "公開"]);
	});

	it("accessibleStatuses が status.published からフォールバックされる", () => {
		expect(schema.accessibleStatuses).toEqual(["Published", "公開"]);
	});

	it("accessible を別途指定できる", () => {
		const m2 = defineMapping<Post>({
			...mapping,
			status: {
				type: "status",
				notion: "Status",
				published: ["Published"],
				accessible: ["Published", "Draft"],
			},
		});
		const s2 = defineSchema(PostSchema, m2);
		expect(s2.publishedStatuses).toEqual(["Published"]);
		expect(s2.accessibleStatuses).toEqual(["Published", "Draft"]);
	});

	it("select 型でも publishedStatuses が集約される", () => {
		const m3 = defineMapping<Post>({
			...mapping,
			status: {
				type: "select",
				notion: "Status",
				published: ["Active"],
			},
		});
		const s3 = defineSchema(PostSchema, m3);
		expect(s3.publishedStatuses).toEqual(["Active"]);
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
	});
});

// ── 新プロパティ型のユニットテスト ──────────────────────────────────────────

describe("parseField — 新プロパティ型", () => {
	const makePage = (props: Record<string, unknown>) => ({
		id: "page-id",
		last_edited_time: "2024-01-01T00:00:00.000Z",
		properties: props,
	});

	describe("email", () => {
		const Schema = z.object({
			id: z.string(),
			updatedAt: z.string(),
			email: z.string().nullable(),
		});
		const s = defineSchema(
			Schema,
			defineMapping<z.infer<typeof Schema>>({
				email: { type: "email", notion: "Email" },
			}),
		);

		it("email を取得する", () => {
			const item = s.mapItem(
				makePage({
					Email: { type: "email", email: "test@example.com" },
				}) as never,
			);
			expect(item.email).toBe("test@example.com");
		});

		it("未定義時は null", () => {
			const item = s.mapItem(makePage({}) as never);
			expect(item.email).toBeNull();
		});
	});

	describe("phone_number", () => {
		const Schema = z.object({
			id: z.string(),
			updatedAt: z.string(),
			phone: z.string().nullable(),
		});
		const s = defineSchema(
			Schema,
			defineMapping<z.infer<typeof Schema>>({
				phone: { type: "phone_number", notion: "Phone" },
			}),
		);

		it("電話番号を取得する", () => {
			const item = s.mapItem(
				makePage({
					Phone: { type: "phone_number", phone_number: "090-1234-5678" },
				}) as never,
			);
			expect(item.phone).toBe("090-1234-5678");
		});

		it("未定義時は null", () => {
			const item = s.mapItem(makePage({}) as never);
			expect(item.phone).toBeNull();
		});
	});

	describe("status（独立型）", () => {
		const Schema = z.object({
			id: z.string(),
			updatedAt: z.string(),
			status: z.string().nullable(),
		});
		const s = defineSchema(
			Schema,
			defineMapping<z.infer<typeof Schema>>({
				status: {
					type: "status",
					notion: "Status",
					published: ["Done"],
					accessible: ["Done", "In Progress"],
				},
			}),
		);

		it("status プロパティの名前を取得する", () => {
			const item = s.mapItem(
				makePage({
					Status: { type: "status", status: { name: "Done" } },
				}) as never,
			);
			expect(item.status).toBe("Done");
		});

		it("publishedStatuses / accessibleStatuses が集約される", () => {
			expect(s.publishedStatuses).toEqual(["Done"]);
			expect(s.accessibleStatuses).toEqual(["Done", "In Progress"]);
		});

		it("select プロパティでは null を返す（型不一致）", () => {
			const Schema2 = z.object({
				id: z.string(),
				updatedAt: z.string(),
				status: z.string().nullable(),
			});
			const s2 = defineSchema(
				Schema2,
				defineMapping<z.infer<typeof Schema2>>({
					status: { type: "status", notion: "Status" },
				}),
			);
			const item = s2.mapItem(
				makePage({
					Status: { type: "select", select: { name: "Active" } },
				}) as never,
			);
			expect(item.status).toBeNull();
		});
	});

	describe("select（status プロパティを読まない）", () => {
		const Schema = z.object({
			id: z.string(),
			updatedAt: z.string(),
			category: z.string().nullable(),
		});
		const s = defineSchema(
			Schema,
			defineMapping<z.infer<typeof Schema>>({
				category: { type: "select", notion: "Category" },
			}),
		);

		it("select プロパティの名前を取得する", () => {
			const item = s.mapItem(
				makePage({
					Category: { type: "select", select: { name: "Tech" } },
				}) as never,
			);
			expect(item.category).toBe("Tech");
		});

		it("status プロパティでは null を返す（型不一致）", () => {
			const item = s.mapItem(
				makePage({
					Category: { type: "status", status: { name: "Done" } },
				}) as never,
			);
			expect(item.category).toBeNull();
		});
	});

	describe("created_time / last_edited_time", () => {
		const Schema = z.object({
			id: z.string(),
			updatedAt: z.string(),
			createdAt: z.string().nullable(),
			editedAt: z.string().nullable(),
		});
		const s = defineSchema(
			Schema,
			defineMapping<z.infer<typeof Schema>>({
				createdAt: { type: "created_time", notion: "Created time" },
				editedAt: { type: "last_edited_time", notion: "Last edited time" },
			}),
		);

		it("ISO8601 文字列を取得する", () => {
			const item = s.mapItem(
				makePage({
					"Created time": {
						type: "created_time",
						created_time: "2024-01-01T00:00:00.000Z",
					},
					"Last edited time": {
						type: "last_edited_time",
						last_edited_time: "2024-06-01T12:00:00.000Z",
					},
				}) as never,
			);
			expect(item.createdAt).toBe("2024-01-01T00:00:00.000Z");
			expect(item.editedAt).toBe("2024-06-01T12:00:00.000Z");
		});

		it("未定義時は null", () => {
			const item = s.mapItem(makePage({}) as never);
			expect(item.createdAt).toBeNull();
			expect(item.editedAt).toBeNull();
		});
	});

	describe("unique_id", () => {
		const Schema = z.object({
			id: z.string(),
			updatedAt: z.string(),
			taskId: z
				.object({ number: z.number(), prefix: z.string().nullable() })
				.nullable(),
		});
		const s = defineSchema(
			Schema,
			defineMapping<z.infer<typeof Schema>>({
				taskId: { type: "unique_id", notion: "Task ID" },
			}),
		);

		it("number と prefix を取得する", () => {
			const item = s.mapItem(
				makePage({
					"Task ID": {
						type: "unique_id",
						unique_id: { number: 42, prefix: "TASK" },
					},
				}) as never,
			);
			expect(item.taskId).toEqual({ number: 42, prefix: "TASK" });
		});

		it("prefix が null の場合", () => {
			const item = s.mapItem(
				makePage({
					"Task ID": {
						type: "unique_id",
						unique_id: { number: 7, prefix: null },
					},
				}) as never,
			);
			expect(item.taskId).toEqual({ number: 7, prefix: null });
		});

		it("未定義時は null", () => {
			const item = s.mapItem(makePage({}) as never);
			expect(item.taskId).toBeNull();
		});
	});

	describe("people", () => {
		const Schema = z.object({
			id: z.string(),
			updatedAt: z.string(),
			authors: z.array(z.string()),
		});
		const s = defineSchema(
			Schema,
			defineMapping<z.infer<typeof Schema>>({
				authors: { type: "people", notion: "Authors" },
			}),
		);

		it("ユーザー名の配列を返す", () => {
			const item = s.mapItem(
				makePage({
					Authors: {
						type: "people",
						people: [
							{ object: "user", id: "user-1", name: "Alice" },
							{ object: "user", id: "user-2", name: "Bob" },
						],
					},
				}) as never,
			);
			expect(item.authors).toEqual(["Alice", "Bob"]);
		});

		it("name が null の場合は id をフォールバックにする", () => {
			const item = s.mapItem(
				makePage({
					Authors: {
						type: "people",
						people: [{ object: "user", id: "user-3", name: null }],
					},
				}) as never,
			);
			expect(item.authors).toEqual(["user-3"]);
		});

		it("未定義時は空配列", () => {
			const item = s.mapItem(makePage({}) as never);
			expect(item.authors).toEqual([]);
		});
	});

	describe("files", () => {
		const Schema = z.object({
			id: z.string(),
			updatedAt: z.string(),
			attachments: z.array(
				z.object({
					name: z.string(),
					url: z.string(),
					type: z.enum(["external", "file"]),
				}),
			),
		});
		const s = defineSchema(
			Schema,
			defineMapping<z.infer<typeof Schema>>({
				attachments: { type: "files", notion: "Attachments" },
			}),
		);

		it("external ファイルの URL を取得する", () => {
			const item = s.mapItem(
				makePage({
					Attachments: {
						type: "files",
						files: [
							{
								type: "external",
								name: "image.png",
								external: { url: "https://example.com/image.png" },
							},
						],
					},
				}) as never,
			);
			expect(item.attachments).toEqual([
				{
					name: "image.png",
					url: "https://example.com/image.png",
					type: "external",
				},
			]);
		});

		it("Notion ホスト型ファイルの URL を取得する", () => {
			const item = s.mapItem(
				makePage({
					Attachments: {
						type: "files",
						files: [
							{
								type: "file",
								name: "doc.pdf",
								file: {
									url: "https://s3.notion.com/doc.pdf",
									expiry_time: "2024-01-01T00:00:00.000Z",
								},
							},
						],
					},
				}) as never,
			);
			expect(item.attachments).toEqual([
				{ name: "doc.pdf", url: "https://s3.notion.com/doc.pdf", type: "file" },
			]);
		});

		it("未定義時は空配列", () => {
			const item = s.mapItem(makePage({}) as never);
			expect(item.attachments).toEqual([]);
		});
	});

	describe("relation", () => {
		const Schema = z.object({
			id: z.string(),
			updatedAt: z.string(),
			relatedPages: z.array(z.object({ id: z.string() })),
		});
		const s = defineSchema(
			Schema,
			defineMapping<z.infer<typeof Schema>>({
				relatedPages: { type: "relation", notion: "Related" },
			}),
		);

		it("関連ページの id 配列を返す", () => {
			const item = s.mapItem(
				makePage({
					Related: {
						type: "relation",
						relation: [{ id: "page-a" }, { id: "page-b" }],
						has_more: false,
					},
				}) as never,
			);
			expect(item.relatedPages).toEqual([{ id: "page-a" }, { id: "page-b" }]);
		});

		it("未定義時は空配列", () => {
			const item = s.mapItem(makePage({}) as never);
			expect(item.relatedPages).toEqual([]);
		});
	});

	describe("formula", () => {
		const Schema = z.object({
			id: z.string(),
			updatedAt: z.string(),
			computed: z.union([z.string(), z.number(), z.boolean()]).nullable(),
		});
		const s = defineSchema(
			Schema,
			defineMapping<z.infer<typeof Schema>>({
				computed: { type: "formula", notion: "Computed" },
			}),
		);

		it("number formula を返す", () => {
			const item = s.mapItem(
				makePage({
					Computed: {
						type: "formula",
						formula: { type: "number", number: 99 },
					},
				}) as never,
			);
			expect(item.computed).toBe(99);
		});

		it("string formula を返す", () => {
			const item = s.mapItem(
				makePage({
					Computed: {
						type: "formula",
						formula: { type: "string", string: "hello" },
					},
				}) as never,
			);
			expect(item.computed).toBe("hello");
		});

		it("boolean formula を返す", () => {
			const item = s.mapItem(
				makePage({
					Computed: {
						type: "formula",
						formula: { type: "boolean", boolean: true },
					},
				}) as never,
			);
			expect(item.computed).toBe(true);
		});

		it("date formula は null を返す", () => {
			const item = s.mapItem(
				makePage({
					Computed: {
						type: "formula",
						formula: { type: "date", date: { start: "2024-01-01" } },
					},
				}) as never,
			);
			expect(item.computed).toBeNull();
		});

		it("未定義時は null", () => {
			const item = s.mapItem(makePage({}) as never);
			expect(item.computed).toBeNull();
		});
	});

	describe("created_by / last_edited_by", () => {
		const Schema = z.object({
			id: z.string(),
			updatedAt: z.string(),
			author: z
				.object({ id: z.string(), name: z.string().optional() })
				.nullable(),
			editor: z
				.object({ id: z.string(), name: z.string().optional() })
				.nullable(),
		});
		const s = defineSchema(
			Schema,
			defineMapping<z.infer<typeof Schema>>({
				author: { type: "created_by", notion: "Created by" },
				editor: { type: "last_edited_by", notion: "Last edited by" },
			}),
		);

		it("ユーザーオブジェクトを取得する", () => {
			const item = s.mapItem(
				makePage({
					"Created by": {
						type: "created_by",
						created_by: { object: "user", id: "user-1", name: "Alice" },
					},
					"Last edited by": {
						type: "last_edited_by",
						last_edited_by: { object: "user", id: "user-2", name: "Bob" },
					},
				}) as never,
			);
			expect(item.author).toEqual({ id: "user-1", name: "Alice" });
			expect(item.editor).toEqual({ id: "user-2", name: "Bob" });
		});

		it("未定義時は null", () => {
			const item = s.mapItem(makePage({}) as never);
			expect(item.author).toBeNull();
			expect(item.editor).toBeNull();
		});
	});
});
