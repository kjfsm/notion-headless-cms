"use client";

// content:"react" モードのアイテムの notionBlocks() を描画する React グルー。
// blocks 戦略の高忠実度レンダラ (react-renderer) と再検証フックを 1 か所に集約する。
export type {
  NotionBlock,
  NotionRendererProps as RendererProps,
} from "@notion-headless-cms/react-renderer";
export { NotionRenderer as Renderer } from "@notion-headless-cms/react-renderer";
export {
  NotionRevalidator,
  useNotionRevalidate,
} from "@notion-headless-cms/react-renderer/router";
