"use client";

import type { ColumnBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { cn } from "../lib/utils";
import type { BlockComponentProps } from "../types";

export function Column({
  block,
  renderChildren,
  className,
}: BlockComponentProps<ColumnBlockObjectResponse>) {
  return (
    <div className={cn("min-w-0", className)}>
      {block.children && renderChildren ? renderChildren(block.children) : null}
    </div>
  );
}
