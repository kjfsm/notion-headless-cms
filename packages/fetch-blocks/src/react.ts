"use client";

export type { NotionRendererProps as RendererProps } from "@notion-headless-cms/react-renderer";
// blocks 戦略の React 描画は既存の `@notion-headless-cms/react-renderer` をそのまま使う。
// 利用側が `mode` を切り替える時に import 行を fetch-blocks/react ↔ fetch-markdown/react で
// 対称に書けるよう、`Renderer` という別名で再エクスポートする。
export { NotionRenderer as Renderer } from "@notion-headless-cms/react-renderer";
