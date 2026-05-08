import type { PluggableList } from "unified";

/**
 * カスタムレンダラー関数の型。
 * Markdownを受け取り、HTMLを返す。
 * core の RendererFn と構造的に互換。
 */
export type RendererFn = (
  markdown: string,
  options?: {
    imageProxyBase?: string;
    cacheImage?: (notionUrl: string) => Promise<string>;
    remarkPlugins?: PluggableList;
    rehypePlugins?: PluggableList;
  },
) => Promise<string>;

/** renderMarkdown のオプション。 */
export interface RendererOptions {
  /** 画像プロキシのベースURL。デフォルト: '/api/images' */
  imageProxyBase?: string;
  /**
   * Notion画像URLをキャッシュしてプロキシURLを返す関数。
   * 未指定の場合は画像URLをそのまま使用する（ローカル開発向け）。
   */
  cacheImage?: (notionUrl: string) => Promise<string>;
  /** 追加する remark プラグイン。 */
  remarkPlugins?: PluggableList;
  /** 追加する rehype プラグイン。 */
  rehypePlugins?: PluggableList;
  /** デフォルトのパイプラインを置き換えるカスタムレンダラー。 */
  render?: RendererFn;
  /**
   * Markdown 内の生 HTML をそのまま rehype ツリーに通す。
   * true のとき remark-rehype を allowDangerousHtml: true で呼ぶ。
   * notionEmbed が返す HTML を通したい場合に使う。
   * デフォルト: false (セキュアな既定動作を維持)
   */
  allowDangerousHtml?: boolean;
}
