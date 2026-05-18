import type { ContentExtension } from "@notion-headless-cms/notion-orm";
import rehypeKatex from "rehype-katex";

/** `notionKatex()` のオプション。KaTeX の renderToString に渡すオプションのサブセット。 */
export interface NotionKatexOptions {
  /** 数式をブロック表示（display mode）にする。デフォルト: true。 */
  displayMode?: boolean;
  /** レンダリングエラーを throw する。false の場合はエラー時に数式をそのまま表示する。デフォルト: false。 */
  throwOnError?: boolean;
  /** KaTeX マクロ定義。 */
  macros?: Record<string, string>;
}

/**
 * Notion の equation ブロック・インライン数式を KaTeX で描画する `ContentExtension` を返す。
 *
 * markdown 戦略: `rehype-katex` を unified パイプラインへ注入する。
 * `remarkMath` はパイプラインに既存のため `rehypePlugins` のみ追加。
 *
 * @example
 * ```ts
 * import { notionKatex } from "@notion-headless-cms/notion-katex";
 *
 * // markdown 戦略
 * <Renderer content={item.content} extensions={[notionKatex()]} />
 * ```
 */
export function notionKatex(opts?: NotionKatexOptions): ContentExtension {
  const katexOpts = {
    displayMode: opts?.displayMode ?? true,
    throwOnError: opts?.throwOnError ?? false,
    ...(opts?.macros && { macros: opts.macros }),
  };
  return {
    getMarkdownPlugins() {
      return { rehypePlugins: [[rehypeKatex, katexOpts]] };
    },
  };
}
