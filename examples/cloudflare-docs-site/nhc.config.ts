import "dotenv/config";
import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
  notionToken: env("NOTION_TOKEN"),
  output: "./app/generated/nhc.ts",
  collections: {
    docs: {
      dbName: "ドキュメントDB",
      slugField: "slug",
      statusField: "status",
      publishedStatuses: ["完了"],
      accessibleStatuses: ["未着手", "進行中", "完了"],
      // 日本語プロパティ名は識別子に自動変換できないため明示マッピングする。
      fieldMappings: {
        名前: "name",
        スラッグ: "slug",
        セクション: "section",
        順序: "order",
        ステータス: "status",
        説明: "description",
      },
    },
    pages: {
      dbName: "固定ページDB",
      slugField: "slug",
      statusField: "status",
      publishedStatuses: ["完了"],
      accessibleStatuses: ["未着手", "進行中", "完了"],
      fieldMappings: {
        名前: "name",
        スラッグ: "slug",
        ステータス: "status",
        説明: "description",
      },
    },
  },
});
