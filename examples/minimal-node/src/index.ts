import { createCMS } from "@notion-headless-cms/client";
import { schema } from "./generated/nhc.js";

const cms = createCMS({
  notion: {
    schema,
    token: process.env.NOTION_TOKEN ?? "",
    collections: { posts: { published: ["公開済み"] } },
  },
});

const posts = await cms.posts.list();
console.log(`${posts.length} 件の記事を取得しました`);
for (const post of posts) {
  console.log(`- ${post.slug}\t${post.title ?? "(no title)"}`);
}
