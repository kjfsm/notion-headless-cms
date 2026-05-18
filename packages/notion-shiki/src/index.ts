import type { ContentExtension } from "@notion-headless-cms/notion-orm";
import rehypeShiki from "@shikijs/rehype";

/** `notionShiki()` のオプション。 */
export interface NotionShikiOptions {
  /** shiki テーマ。デフォルト: `"github-dark"` */
  theme?: string;
}

/**
 * Notion の code ブロックを shiki でシンタックスハイライトする `ContentExtension` を返す。
 *
 * markdown 戦略: `@shikijs/rehype` を unified パイプラインへ注入する。
 *
 * @example
 * ```ts
 * import { notionShiki } from "@notion-headless-cms/notion-shiki";
 *
 * // markdown 戦略
 * <Renderer content={item.content} extensions={[notionShiki({ theme: "github-dark" })]} />
 * ```
 */
export function notionShiki(opts?: NotionShikiOptions): ContentExtension {
  return {
    getMarkdownPlugins() {
      return {
        rehypePlugins: [[rehypeShiki, { theme: opts?.theme ?? "github-dark" }]],
      };
    },
  };
}
