import type { BlockHandler } from "./types";

/**
 * Notion Block → Markdown 変換の抽象インターフェース。
 * 既定実装は `notion-to-md v3` ラッパだが、`Transformer` の `converter` オプションに
 * このインターフェースを満たす実装を渡せば差し替え可能。
 *
 * @see {@link Transformer}
 */
export interface BlockConverter {
  convert(pageId: string): Promise<string>;
  registerBlock(type: string, handler: BlockHandler): void;
}
