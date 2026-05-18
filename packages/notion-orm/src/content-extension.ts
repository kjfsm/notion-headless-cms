import type { PluggableList } from "@notion-headless-cms/markdown-html";

/**
 * fetch 戦略（blocks / markdown）両対応の描画拡張インターフェース。
 *
 * - `getBlockComponents()` — blocks 戦略: `NotionRenderer` の `components` にマージされる。
 *   React に依存するためオプション。
 * - `getMarkdownPlugins()` — markdown 戦略: unified パイプラインへ注入する remark/rehype プラグイン。
 *
 * @example
 * ```ts
 * const extensions = [notionKatex(), notionShiki()];
 * // markdown 戦略
 * <Renderer content={item.content} extensions={extensions} />
 * // blocks 戦略（getBlockComponents が実装されている場合に有効）
 * <NotionRenderer blocks={item.blocks} extensions={extensions} />
 * ```
 */
export interface ContentExtension {
  /**
   * blocks 戦略 (`react-renderer`) 向けコンポーネント上書き。
   * `ComponentOverrides` と構造互換のオブジェクトを返す。
   * React 依存を notion-orm に持ち込まないため戻り値を緩い型にしている。
   */
  getBlockComponents?(): Record<string, unknown>;
  /** markdown 戦略 (`fetch-markdown`) 向け unified パイプライン拡張。 */
  getMarkdownPlugins?(): {
    remarkPlugins?: PluggableList;
    rehypePlugins?: PluggableList;
  };
}
