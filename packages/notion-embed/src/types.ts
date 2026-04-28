import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { Schema as SanitizeSchema } from "hast-util-sanitize";

export type { BlockObjectResponse };

/** OGP 取得の結果。 */
export interface OgpData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

/**
 * EmbedProvider と BlockHandler の共通入力。
 * ブロックから抽出した URL と元ブロックを持つ。
 */
export interface EmbedRenderContext {
  block: BlockObjectResponse;
  url: string;
  width?: number;
  height?: number;
}

/**
 * provider / handler が返す出力。
 * 将来 HAST 直返しに拡張するため discriminated union にしてある。
 */
export type EmbedOutput = { kind: "html"; html: string } | { kind: "skip" };

/**
 * 個別の埋め込みサービスを表す provider 定義。
 * URL マッチ、HTML 生成、sanitize 拡張スキーマをセットで持つ。
 */
export interface EmbedProvider {
  id: string;
  match: (url: string) => boolean;
  render: (ctx: EmbedRenderContext) => EmbedOutput | Promise<EmbedOutput>;
  /** この provider の出力を rehype-sanitize が許可するためのスキーマ拡張。 */
  sanitizeSchema?: SanitizeSchema;
}

/** notionEmbed() のオプション。 */
export interface NotionEmbedOptions {
  /** 追加の embed provider。先頭が優先。 */
  providers?: EmbedProvider[];
  /**
   * OGP 取得の設定。
   * true または未指定でデフォルト設定を使う。false で OGP 取得を無効化。
   */
  ogp?: boolean | OgpFetchOptions;
  /**
   * page mention のページタイトルを解決する関数。
   * 未指定の場合は Notion ページ ID をそのまま表示する。
   */
  resolvePageTitle?: (pageId: string) => Promise<string | undefined>;
}

/** OGP 取得オプション。 */
export interface OgpFetchOptions {
  /** キャッシュの TTL (ms)。デフォルト: 5分。 */
  ttlMs?: number;
  /** User-Agent ヘッダー。デフォルト: notion-headless-cms/notion-embed。 */
  userAgent?: string;
}

/** @notion-headless-cms/renderer の BlockHandler と同じシグネチャ。型のみ定義して依存を避ける。 */
export type BlockHandler = (
  block: BlockObjectResponse,
  context: { client: unknown; pageId: string },
) => Promise<string> | string;

/** @notion-headless-cms/renderer の RendererFn と同じシグネチャ。 */
export type RendererFn = (
  markdown: string,
  options?: {
    imageProxyBase?: string;
    cacheImage?: (notionUrl: string) => Promise<string>;
    allowDangerousHtml?: boolean;
    rehypePlugins?: unknown[];
    remarkPlugins?: unknown[];
  },
) => Promise<string>;

/** notionEmbed() が返す値。createCMS の引数に差し込む。 */
export interface NotionEmbedResult {
  /** createCMS({ renderer }) または nodePreset({ renderer }) に渡す。 */
  renderer: RendererFn;
  /** notionCollection({ blocks }) に渡す。 */
  blocks: Record<string, BlockHandler>;
}
