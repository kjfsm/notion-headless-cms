import type {
  BlockEnricher,
  NotionBlockTreeNode,
} from "@notion-headless-cms/notion-orm";
import katex from "katex";

/** `notionKatex()` のオプション。KaTeX の renderToString に渡すオプションのサブセット。 */
export interface NotionKatexOptions {
  /** 数式をブロック表示（display mode）にする。デフォルト: true。 */
  displayMode?: boolean;
  /** レンダリングエラーを throw する。false の場合はエラー時に __cachedHtml を設定しない。デフォルト: false。 */
  throwOnError?: boolean;
  /** KaTeX マクロ定義。 */
  macros?: Record<string, string>;
}

/** equation ブロックに `__cachedHtml` が付与された拡張型。 */
export type EquationBlockWithCachedHtml = {
  type: "equation";
  equation: { expression: string; __cachedHtml: string };
};

/**
 * fetch 時に Notion の equation ブロックを KaTeX で HTML 化し、
 * `block.equation.__cachedHtml` に埋め込む `BlockEnricher` を返す。
 *
 * `react-renderer` の Equation スタブは `__cachedHtml` があれば
 * `dangerouslySetInnerHTML` で描画するため、Workers バンドルから katex を除外できる。
 *
 * @example
 * ```ts
 * import { notionKatex } from "@notion-headless-cms/notion-katex";
 * import { createNotionCollection } from "@notion-headless-cms/notion-orm";
 *
 * source: createNotionCollection({
 *   token: process.env.NOTION_TOKEN,
 *   dataSourceId: "...",
 *   enrichers: [notionKatex({ displayMode: true })],
 * });
 * ```
 */
export function notionKatex(opts?: NotionKatexOptions): BlockEnricher {
  const katexOpts = {
    displayMode: opts?.displayMode ?? true,
    throwOnError: opts?.throwOnError ?? false,
    ...(opts?.macros && { macros: opts.macros }),
  };

  return async (
    blocks: NotionBlockTreeNode[],
  ): Promise<NotionBlockTreeNode[]> => {
    enrichBlocks(blocks, katexOpts);
    return blocks;
  };
}

type KatexRenderOptions = {
  displayMode: boolean;
  throwOnError: boolean;
  macros?: Record<string, string>;
};

function enrichBlocks(
  blocks: NotionBlockTreeNode[],
  opts: KatexRenderOptions,
): void {
  for (const block of blocks) {
    if (block.type === "equation") {
      const eq = block.equation as {
        expression: string;
        __cachedHtml?: string;
      };
      try {
        eq.__cachedHtml = katex.renderToString(eq.expression, opts);
      } catch {
        // レンダリング失敗時は __cachedHtml を設定せず、react-renderer の <pre> フォールバックを使う
      }
    }
    if (block.children?.length) {
      enrichBlocks(block.children, opts);
    }
  }
}
