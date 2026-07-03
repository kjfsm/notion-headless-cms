import { defineCollection, defineSchema, prop } from "@notion-headless-cms/cms";

/**
 * v3 は codegen ではなく TS ファーストでスキーマを書く（`nhc pull` は雛形を
 * 一度だけ生成し、以降はこのファイルを直接編集して育てる運用）。
 *
 * `properties` のキーは実際の Notion プロパティ名と一致させる必要がある
 * （`mapProperties()` がスキーマのキーをそのまま生のプロパティ名として引くため、
 * 英語の別名を付けても値を取得できない）。このDBのプロパティ名はすべて日本語。
 */
const posts = defineCollection({
  dataSourceId: "34a21462-5ae9-80a7-a17b-000b93010c9f",
  slug: "URL",
  properties: {
    名前: prop.title(),
    URL: prop.richText(),
    ステータス: prop.status(["下書き", "編集中", "公開済み"] as const),
    公開日: prop.date(),
    著者: prop.select(),
  },
  statusProperty: "ステータス",
  published: ["公開済み"],
  accessible: ["下書き", "編集中", "公開済み"],
});

export const schema = defineSchema({ posts });
