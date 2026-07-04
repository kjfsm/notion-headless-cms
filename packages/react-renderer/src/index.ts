// tsdown でバンドルすると各ファイルの "use client" が落ちるため、エントリ側でも宣言する
"use client";

export type { BlockSwitchProps } from "./BlockSwitch.js";
export { BlockSwitch } from "./BlockSwitch.js";
export * as Blocks from "./blocks/index.js";
export { Callout } from "./components/callout.js";
export { CodeCollapsibleWrapper } from "./components/code-collapsible-wrapper.js";
export { CopyButton } from "./components/copy-button.js";
export type { NotionRendererContextValue } from "./context.js";
export { useNotionContext } from "./context.js";
export * as Embeds from "./embeds/index.js";
export { NotionBlocks } from "./NotionBlocks.js";
export { NotionRenderer } from "./NotionRenderer.js";
export type {
  NotionTheme,
  NotionThemeProviderProps,
} from "./NotionThemeProvider.js";
export { NotionThemeProvider } from "./NotionThemeProvider.js";
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
  PageLinkMap,
  ResolvedPageLink,
} from "./types.js";
