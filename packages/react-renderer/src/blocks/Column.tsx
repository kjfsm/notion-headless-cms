"use client";

import type { ColumnBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { BlockComponentProps } from "../types";

export function Column({
  block,
  renderChildren,
}: BlockComponentProps<ColumnBlockObjectResponse>) {
  return (
    <div className="min-w-0">
      {block.children && renderChildren ? renderChildren(block.children) : null}
    </div>
  );
}
