// このファイルは nhc generate により自動生成されました。手動編集は nhc generate で上書きされます。
// Generated: 2026-04-22T09:19:20.885Z

import { z } from "zod";
import { defineMapping, defineSchema } from "@notion-headless-cms/source-notion";
import type { BaseContentItem } from "@notion-headless-cms/core";

// ===========================================================
// posts  (ブログ記事DB)
// Notion DB ID: 34a21462-5ae9-80a7-a17b-000b93010c9f
// ===========================================================

export interface PostsItem extends BaseContentItem {
	status: string;
	publishedAt: string;
}

const _postsZodSchema = z.object({
		id: z.string(),
		updatedAt: z.string(),
		slug: z.string().nullable().transform((s) => s ?? ""),
		status: z.string().nullable().transform((s) => s ?? ""),
		publishedAt: z.string().nullable().transform((s) => s ?? ""),
});

const _postsMapping = defineMapping<PostsItem>({
		slug: { type: "title", notion: "名前" },
		status: { type: "select", notion: "ステータス" },
		publishedAt: { type: "date", notion: "公開日" },
});

export const postsSchema = defineSchema(_postsZodSchema, _postsMapping);
export const postsSourceId = "34a21462-5ae9-80a7-a17b-000b93010c9f";

// ===========================================================
// NHC Multi-Source Schema
// ===========================================================

export const nhcSchema = {
	posts: {
		id: postsSourceId,
		dbName: "ブログ記事DB",
		schema: postsSchema,
	},
} as const;

export type NHCSchema = typeof nhcSchema;
