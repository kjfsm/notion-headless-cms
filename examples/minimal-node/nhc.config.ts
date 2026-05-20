import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
  notionToken: env("NOTION_TOKEN"),
  output: "./src/generated/nhc.ts",
  collections: {
    posts: {
      dbName: env("DB_NAME") || "ブログ記事DB",
      slugField: "slug",
      statusField: "status",
      publishedStatuses: ["公開済み"],
    },
  },
});
