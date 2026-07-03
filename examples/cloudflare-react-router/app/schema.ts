import { defineCollection, defineSchema, prop } from "@notion-headless-cms/cms";

/**
 * v3 は codegen ではなく TS ファーストでスキーマを書く（`nhc pull` は雛形を
 * 一度だけ生成し、以降はこのファイルを直接編集して育てる運用）。
 *
 * このDBのプロパティ名は日本語（名前/URL/ステータス/公開日/著者）。スキーマの
 * キー自体を実プロパティ名にする必要は無く、`prop.*("実プロパティ名")` で
 * 別名を指定できる（`mapProperties()` が `raw[def.notion ?? key]` で解決する）。
 */
const posts = defineCollection({
  dataSourceId: "34a21462-5ae9-80a7-a17b-000b93010c9f",
  slug: "slug",
  properties: {
    title: prop.title("名前"),
    slug: prop.richText("URL"),
    status: prop.status(
      ["下書き", "編集中", "公開済み"] as const,
      "ステータス",
    ),
    publishedAt: prop.date("公開日"),
    author: prop.select(undefined, "著者"),
  },
  statusProperty: "status",
  published: ["公開済み"],
  accessible: ["下書き", "編集中", "公開済み"],
});

export const schema = defineSchema({ posts });
