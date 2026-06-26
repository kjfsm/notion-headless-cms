import type { ContentExtension } from "@notion-headless-cms/notion-orm";
import rehypePrettyCode from "rehype-pretty-code";
import { type NotionShikiOptions, rehypePrettyCodeOptions } from "./options.js";

export {
  type HighlightCodeBlocksOptions,
  highlightCodeBlocks,
} from "./highlight-code-blocks.js";
export type { NotionShikiOptions } from "./options.js";

/**
 * Notion の code ブロックを rehype-pretty-code（shiki）でシンタックスハイライト
 * する `ContentExtension` を返す（markdown 戦略向け）。
 *
 * blocks 戦略（`content: "react"`）で使う場合は `highlightCodeBlocks()` を
 * 表示前のサーバー前処理として呼ぶ。
 *
 * @example
 * ```ts
 * import { notionShiki } from "@notion-headless-cms/notion-shiki";
 *
 * <Renderer
 *   content={item.content}
 *   extensions={[notionShiki({ themes: { light: "github-light", dark: "github-dark" } })]}
 * />
 * ```
 */
export function notionShiki(opts?: NotionShikiOptions): ContentExtension {
  return {
    getMarkdownPlugins() {
      return {
        rehypePlugins: [[rehypePrettyCode, rehypePrettyCodeOptions(opts)]],
      };
    },
  };
}
