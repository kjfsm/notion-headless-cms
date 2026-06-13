import { createCMS } from "@notion-headless-cms/client";
import { schema } from "../generated/nhc.js";

export const cms = createCMS({
  notion: {
    schema,
    token: process.env.NOTION_TOKEN ?? "",
    collections: {
      posts: {
        published: ["公開済み"],
        accessible: ["下書き", "編集中", "公開済み"],
      },
    },
  },
  render: { content: "html" },
});
