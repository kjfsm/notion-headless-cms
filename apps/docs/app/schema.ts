import {
  defineCollection,
  defineSchema,
  type InferSchemaEntries,
  prop,
} from "@notion-headless-cms/cms";

/** 固定ページDB（ランディング + about 等）。 */
const pages = defineCollection({
  dataSourceId: "51b3350b-d501-478c-815d-09447827e114",
  slug: "slug",
  properties: {
    name: prop.title("名前"),
    slug: prop.richText("スラッグ"),
    description: prop.richText("説明"),
    status: prop.status(["未着手", "進行中", "完了"] as const, "ステータス"),
  },
  statusProperty: "status",
  published: ["完了"],
  accessible: ["未着手", "進行中", "完了"],
});

export const schema = defineSchema({ pages });

type SchemaEntries = InferSchemaEntries<typeof schema>;
export type Page = SchemaEntries["pages"];
