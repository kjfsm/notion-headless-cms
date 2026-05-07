"use client";

import { useMemo } from "react";
import { NotionContext } from "./context.js";
import { cn } from "./lib/utils.js";
import { NotionBlocks } from "./NotionBlocks.js";
import type { NotionRendererProps } from "./types.js";

export function NotionRenderer({
  blocks,
  components,
  className,
  classNames,
}: NotionRendererProps) {
  const contextValue = useMemo(
    () => ({ components: components ?? {}, classNames }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [components, classNames],
  );
  return (
    <NotionContext.Provider value={contextValue}>
      <div className={cn("notion-renderer", className)}>
        <NotionBlocks blocks={blocks} />
      </div>
    </NotionContext.Provider>
  );
}
