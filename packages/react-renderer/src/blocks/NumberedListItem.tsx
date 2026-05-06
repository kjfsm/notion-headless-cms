"use client";

import type { NumberedListItemBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { cn } from "../lib/utils";
import { RichText } from "../rich-text/RichText";
import type { BlockComponentProps } from "../types";

export function NumberedListItem({
  block,
  renderChildren,
  className,
}: BlockComponentProps<NumberedListItemBlockObjectResponse>) {
  return (
    <li className={cn("leading-7", className)}>
      <RichText value={block.numbered_list_item.rich_text} />
      {block.children && renderChildren ? (
        <div className="ml-2">{renderChildren(block.children)}</div>
      ) : null}
    </li>
  );
}
