"use client";

import { useMemo } from "react";

import { NotionContext } from "./context.js";
import { extractHeadings } from "./lib/extract-headings.js";
import { cn } from "./lib/utils.js";
import { NotionBlocks } from "./NotionBlocks.js";
import type { ComponentOverrides, NotionRendererProps } from "./types.js";

/**
 * Notion ブロック木 (`NotionBlockTreeNode[]`) を React で描画するエントリ。
 * `components` / `classNames` を Context に注入して各ブロックコンポーネントへ伝搬する。
 * TOC のために heading_1..4 を抽出して Context へ流す。
 *
 * @example
 * ```tsx
 * import { NotionRenderer } from "@notion-headless-cms/react-renderer";
 *
 * export function Article({ blocks }: { blocks: NotionBlock[] }) {
 *   return (
 *     <NotionRenderer
 *       blocks={blocks}
 *       className="prose dark:prose-invert"
 *       imageSizes={[400, 800, 1200]}
 *     />
 *   );
 * }
 * ```
 *
 * @see {@link NotionThemeProvider} ダークモード切替を組み合わせる場合。
 * @see {@link NotionBlocks} 既に Context が確立されている子ツリー描画用。
 */
export function NotionRenderer({
  blocks,
  components,
  extensions,
  className,
  classNames,
  resolveImageUrl,
  pageLinks,
  resolvePageUrl,
  resolvePageTitle,
  Image: ImageSlot,
  Link: LinkSlot,
  imageSizes,
  imageSizesAttr,
  ogpEndpoint,
}: NotionRendererProps) {
  const headings = useMemo(() => extractHeadings(blocks), [blocks]);
  const mergedComponents = useMemo(() => {
    const fromExt = Object.assign(
      {},
      ...(extensions ?? []).map((e) => e.getBlockComponents?.() ?? {}),
    );
    return { ...fromExt, ...components } as ComponentOverrides;
  }, [extensions, components]);
  const contextValue = useMemo(
    () => ({
      components: mergedComponents,
      classNames,
      resolveImageUrl,
      pageLinks,
      resolvePageUrl,
      resolvePageTitle,
      Image: ImageSlot,
      Link: LinkSlot,
      headings,
      listDepth: 0,
      imageSizes,
      imageSizesAttr,
      ogpEndpoint,
    }),
    [
      mergedComponents,
      classNames,
      resolveImageUrl,
      pageLinks,
      resolvePageUrl,
      resolvePageTitle,
      ImageSlot,
      LinkSlot,
      headings,
      imageSizes,
      imageSizesAttr,
      ogpEndpoint,
    ],
  );
  return (
    <NotionContext.Provider value={contextValue}>
      <div className={cn("notion-renderer", className)}>
        <NotionBlocks blocks={blocks} />
      </div>
    </NotionContext.Provider>
  );
}
