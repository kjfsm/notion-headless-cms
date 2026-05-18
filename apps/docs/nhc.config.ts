import "dotenv/config";
import { defineConfig, env } from "@notion-headless-cms/cli";

// ドキュメント本体は docs/ 配下の md を直接配信するため、Notion へ置くのは
// ランディング・固定ページ (about / showcase など) のみ。docs コレクションは廃止した。
export default defineConfig({
  notionToken: env("NOTION_TOKEN"),
  output: "./app/generated/nhc.ts",
  collections: {
    pages: {
      dbName: "固定ページDB",
      slugField: "slug",
      statusField: "status",
      publishedStatuses: ["完了"],
      accessibleStatuses: ["未着手", "進行中", "完了"],
      // 日本語プロパティ名は識別子に自動変換できないため明示マッピングする。
      fieldMappings: {
        名前: "name",
        スラッグ: "slug",
        ステータス: "status",
        説明: "description",
      },
    },
  },
});
