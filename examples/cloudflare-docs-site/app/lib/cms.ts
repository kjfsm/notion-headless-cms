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
        fetch: markdownFetcher(),
        publishOptions: {
          docs: {
            publishedStatuses: ["完了"],
            accessibleStatuses: ["未着手", "進行中", "完了"],
          },
          pages: {
            publishedStatuses: ["完了"],
            accessibleStatuses: ["未着手", "進行中", "完了"],
          },
        },
      }),
    },
    renderer: notionMarkdownRenderer,
    ...cloudflarePreset({ env, ctx }),
  });
}
