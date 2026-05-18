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
 */
export function NotionRenderer({
  blocks,
  components,
  extensions,
  className,
  classNames,
  resolveImageUrl,
  resolvePageUrl,
  resolvePageTitle,
  Image: ImageSlot,
  Link: LinkSlot,
}: NotionRendererProps) {
  const headings = useMemo(() => extractHeadings(blocks), [blocks]);
  const mergedComponents = useMemo(() => {
    const fromExt = Object.assign(
      {},
      ...(extensions ?? []).map((e) => e.getBlockComponents?.() ?? {}),
    );
    return { ...fromExt, ...(components ?? {}) } as ComponentOverrides;
  }, [extensions, components]);
  const contextValue = useMemo(
    () => ({
      components: mergedComponents,
      classNames,
      resolveImageUrl,
      resolvePageUrl,
      resolvePageTitle,
      Image: ImageSlot,
      Link: LinkSlot,
      headings,
      listDepth: 0,
    }),
    [
      mergedComponents,
      classNames,
      resolveImageUrl,
      resolvePageUrl,
      resolvePageTitle,
      ImageSlot,
      LinkSlot,
      headings,
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
