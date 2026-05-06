"use client";

import type { BulletedListItemBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { cn } from "../lib/utils";
import { RichText } from "../rich-text/RichText";
import type { BlockComponentProps } from "../types";

export function BulletedListItem({
  block,
  renderChildren,
  className,
}: BlockComponentProps<BulletedListItemBlockObjectResponse>) {
  return (
    <li className={cn("leading-7", className)}>
      <RichText value={block.bulleted_list_item.rich_text} />
      {block.children && renderChildren ? (
        <div className="ml-2">{renderChildren(block.children)}</div>
      ) : null}
    </li>
  );
}
