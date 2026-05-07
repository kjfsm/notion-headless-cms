// このパッケージ全体がクライアント側コンポーネント。tsdown が単一ファイルにバンドルする
// 際に各ファイルの "use client" が脱落するため、エントリ先頭でも宣言する。
"use client";

export type { BlockSwitchProps } from "./BlockSwitch.js";
export { BlockSwitch } from "./BlockSwitch.js";
export * as Blocks from "./blocks/index.js";
export type { NotionRendererContextValue } from "./context.js";
export { useNotionContext } from "./context.js";
export * as Embeds from "./embeds/index.js";
export { NotionBlocks } from "./NotionBlocks.js";
export { NotionRenderer } from "./NotionRenderer.js";
export type { CacheImageFn } from "./resolve-image-urls.js";
export { resolveBlockImageUrls } from "./resolve-image-urls.js";
export { Caption } from "./rich-text/Caption.js";
export { RichText } from "./rich-text/RichText.js";
export type {
  BlockClassNames,
  BlockComponentProps,
  ComponentOverrides,
  HeadingBlockObjectResponse,
  NotionBlock,
  NotionRendererProps,
} from "./types.js";
