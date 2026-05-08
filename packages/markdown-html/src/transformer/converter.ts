import type { BlockHandler } from "./types";

/** Notion Block → Markdown 変換の抽象インターフェース。 */
export interface BlockConverter {
  convert(pageId: string): Promise<string>;
  registerBlock(type: string, handler: BlockHandler): void;
}
