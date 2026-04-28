import type { Client } from "@notionhq/client";
import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

/** ブロックハンドラーが受け取るコンテキスト。 */
export interface TransformContext {
  client: Client;
  pageId: string;
}

/** カスタムブロックハンドラーの型。同期・非同期どちらも可。 */
export type BlockHandler = (
  block: BlockObjectResponse,
  context: TransformContext,
) => Promise<string> | string;

/** Transformer の設定オブジェクト。 */
export interface TransformerConfig {
  /** 初期登録するカスタムブロックハンドラーのマップ。 */
  blocks?: Record<string, BlockHandler>;
}
