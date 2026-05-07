"use client";

import type { ColumnBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { cn } from "../lib/utils.js";
import { NotionBlocks } from "../NotionBlocks.js";
import type { BlockComponentProps } from "../types.js";

export function Column({
  block,
  className,
}: BlockComponentProps<ColumnBlockObjectResponse>) {
  return (
    <div className={cn("min-w-0", className)}>
      {block.children ? <NotionBlocks blocks={block.children} /> : null}
    </div>
  );
}
