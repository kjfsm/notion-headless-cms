import type { Client } from "@notionhq/client";
import type { NotionBlockTreeNode } from "./block-tree";

/**
 * Notion ページ本文の取得戦略。
 * `@notion-headless-cms/fetch-blocks` と `@notion-headless-cms/fetch-markdown` が
 * 実装し、`notionSource({ fetch })` 経由で `NotionCollection` に注入される。
 *
 * `loadNotionBlocks` を持たない戦略 (markdown 戦略) は `NotionRenderer` のような
 * BlockObjectResponse ツリー前提の描画には使えない。代わりに対応する
 * `<Renderer />` (markdown→React) を使う。
 */
export interface ContentFetcher {
  /** 戦略識別子。ログや診断目的。 */
  readonly kind: "blocks" | "markdown";
  /**
   * ページ本文を Markdown 文字列で返す。
   * `blocks` 戦略では fetchBlockTree + notion-to-md、
   * `markdown` 戦略では Notion Markdown export API 1 リクエストで取得する。
   */
  loadMarkdown(
    client: Client,
    pageId: string,
    ctx: FetchContext,
  ): Promise<string>;
  /**
   * Notion ブロックツリーを返す。`blocks` 戦略のみが実装する。
   * 未実装の戦略 (markdown など) を選んだ場合、
   * `NotionCollection.loadNotionBlocks` は `source/blocks_unsupported` を throw する。
   */
  loadNotionBlocks?(
    client: Client,
    pageId: string,
    ctx: FetchContext,
  ): Promise<NotionBlockTreeNode[]>;
}

/**
 * fetcher に渡すリクエスト文脈。
 * Markdown export API は `@notionhq/client` の `Client` から到達できないため、
 * 認証トークンを別途渡せるようにしている。
 */
export interface FetchContext {
  token: string;
}
