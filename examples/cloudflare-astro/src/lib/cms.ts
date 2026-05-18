import {
  cloudflarePreset,
  createClient,
  notionSource,
} from "@notion-headless-cms/cloudflare";
import {
  markdownFetcher,
  notionMarkdownRenderer,
} from "@notion-headless-cms/fetch-markdown";
import { schema } from "../generated/nhc";

export interface Env {
  NOTION_TOKEN: string;
  DOC_CACHE?: KVNamespace;
  IMG_BUCKET?: R2Bucket;
}

export function makeCms(
  env: Env,
  ctx: { waitUntil(p: Promise<unknown>): void },
) {
  return createClient({
    sources: {
      notion: notionSource({
        schema,
        token: env.NOTION_TOKEN,
        // Cloudflare Workers Free プランの 50 subrequest 上限を回避するため、
        // Notion Markdown export API を 1 リクエストで叩く戦略を使う。
        fetch: markdownFetcher(),
        publishOptions: {
          posts: {
            publishedStatuses: ["公開済み"],
            accessibleStatuses: ["下書き", "編集中", "公開済み"],
          },
        },
      }),
    },
    // markdownFetcher が返す Notion enhanced markdown を理解する renderer。
    renderer: notionMarkdownRenderer,
    ...cloudflarePreset({ env, ctx }),
  });
}
