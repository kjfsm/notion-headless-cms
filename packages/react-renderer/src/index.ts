// このパッケージ全体がクライアント側コンポーネント。tsdown が単一ファイルにバンドルする
// 際に各ファイルの "use client" が脱落するため、エントリ先頭でも宣言する。
"use client";

export type { BlockSwitchProps } from "./BlockSwitch";
export { BlockSwitch } from "./BlockSwitch";
export * as Blocks from "./blocks";
export * as Embeds from "./embeds";
export { NotionRenderer } from "./NotionRenderer";
export { Caption } from "./rich-text/Caption";
export { RichText } from "./rich-text/RichText";
export type {
  BlockComponentProps,
  ComponentOverrides,
  NotionBlock,
  NotionRendererProps,
} from "./types";
