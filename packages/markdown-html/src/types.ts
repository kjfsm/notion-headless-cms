import type { PluggableList } from "unified";

/**
 * remark / rehype プラグインリストの不透明型。
 * core の `RendererPluginList` (`unknown[]`) と構造的に揃え、
 * 関数パラメータの反変性で `core` から `markdown-html` のレンダラーへ
 * そのまま代入できるようにする。実体は `unified` の `PluggableList`。
 */
export type RendererPluginList = unknown[];

/**
 * カスタムレンダラー関数の型。Markdown を受け取り、HTML を返す。
 * core の RendererFn と構造的に互換 (反変性で代入可能)。
 * Notion 以外の MDX レンダラーや HTML サニタイザを噛ませたい場合に使う。
 *
 * @example
 * ```ts
 * // remark-rehype の代わりに自前パイプラインを差し替える
 * const render: RendererFn = async (md, _opts) => {
 *   const html = myMarkdownToHtml(md);
 *   return html;
 * };
 * createClient({ renderer: render });
 * ```
 */
export type RendererFn = (
  markdown: string,
  options?: {
    imageProxyBase?: string;
    cacheImage?: (notionUrl: string) => Promise<string>;
    remarkPlugins?: RendererPluginList;
    rehypePlugins?: RendererPluginList;
  },
) => Promise<string>;

/**
 * {@link renderMarkdown} の引数オプション。
 *
 * - `imageProxyBase` / `cacheImage` で Notion 署名 URL を永続キャッシュに置換
 * - `remarkPlugins` / `rehypePlugins` で拡張
 * - `render` でパイプライン全体を差し替え
 * - `allowDangerousHtml` で生 HTML を通すか選択 (既定 false)
 */
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
