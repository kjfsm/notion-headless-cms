"use client";

import type { ColumnListBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { cn } from "../lib/utils";
import type { BlockComponentProps } from "../types";

export function ColumnList({
  block,
  renderChildren,
  className,
}: BlockComponentProps<ColumnListBlockObjectResponse>) {
  const cols = block.children ?? [];
  return (
    <div
      className={cn("my-3 grid gap-4", className)}
      style={{
        // 各 column を等幅で並べる。column_ratio は親では取れないため利用側で調整できるよう class 委譲
        gridTemplateColumns: `repeat(${Math.max(cols.length, 1)}, minmax(0, 1fr))`,
      }}
    >
      {renderChildren ? renderChildren(cols) : null}
    </div>
  );
}
