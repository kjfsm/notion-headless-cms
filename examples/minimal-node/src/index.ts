import {
  createClient,
  nodePreset,
  notionSource,
} from "@notion-headless-cms/node";
import { schema } from "./generated/nhc.js";

const cms = createClient({
  sources: {
    notion: notionSource({
      schema,
      token: process.env.NOTION_TOKEN ?? "",
      publishOptions: { posts: { publishedStatuses: ["公開済み"] } },
    }),
  },
  ...nodePreset(),
});

const posts = await cms.posts.list();
console.log(`${posts.length} 件の記事を取得しました`);
for (const post of posts) {
  console.log(`- ${post.slug}\t${post.title ?? "(no title)"}`);
}
