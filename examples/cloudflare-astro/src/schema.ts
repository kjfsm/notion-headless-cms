import { defineCollection, defineSchema, prop } from "@notion-headless-cms/cms";

/**
 * v3 は codegen ではなく TS ファーストでスキーマを書く（`nhc pull` は雛形を
 * 一度だけ生成し、以降はこのファイルを直接編集して育てる運用）。
 */
const posts = defineCollection({
  dataSourceId: "d8221462-5ae9-8396-bdac-8731f4ef685a",
  slug: "slug",
  properties: {
    title: prop.title(),
    slug: prop.richText(),
    status: prop.status(["下書き", "編集中", "公開済み"] as const),
    publishedAt: prop.date(),
    author: prop.select(),
  },
  statusProperty: "status",
  published: ["公開済み"],
  accessible: ["下書き", "編集中", "公開済み"],
});

export const schema = defineSchema({ posts });
