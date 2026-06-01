import { createCMS } from "@notion-headless-cms/client";
import { schema } from "../generated/nhc.js";

const token = process.env.NOTION_TOKEN;
if (!token) {
  throw new Error("NOTION_TOKEN env が設定されていません。");
}

export const cms = createCMS({
  schema,
  token,
  content: "html",
  collections: {
    posts: {
      published: ["公開済み"],
      accessible: ["下書き", "編集中", "公開済み"],
    },
  },
});
