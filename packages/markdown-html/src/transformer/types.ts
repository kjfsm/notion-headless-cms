import type { Client } from "@notionhq/client";
import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

/**
 * {@link BlockHandler} に渡される変換コンテキスト。
 * ハンドラから追加の Notion API 呼び出し (子ブロック取得など) をする際に使う。
 */
export interface TransformContext {
  client: Client;
  pageId: string;
}

/**
 * カスタムブロックハンドラーの型。同期・非同期どちらも可。
 * 該当 block type に対する Markdown 表現を返す。
 *
 * @example
 * ```ts
 * const handleCallout: BlockHandler = (block) => {
 *   if (block.type !== "callout") return "";
 *   return `> ${block.callout.rich_text.map((t) => t.plain_text).join("")}`;
 * };
 * ```
 *
 * @see {@link TransformerConfig.blocks} 一括登録の方法。
 */
export type BlockHandler = (
  block: BlockObjectResponse,
  context: TransformContext,
) => Promise<string> | string;

/**
 * {@link Transformer} の設定オブジェクト。`blocks` でカスタムハンドラーを一括登録できる。
 *
 * @see {@link createTransformer}
 */
export interface TransformerConfig {
  /** 初期登録するカスタムブロックハンドラーのマップ。 */
  blocks?: Record<string, BlockHandler>;
}
