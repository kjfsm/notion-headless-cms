"use client";

import type { NumberedListItemBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { notionBlockColorClass } from "../lib/notion-color.js";
import { cn } from "../lib/utils.js";
import { NotionBlocks } from "../NotionBlocks.js";
import { RichText } from "../rich-text/RichText.js";
import type { BlockComponentProps } from "../types.js";

export function NumberedListItem({
  block,
  className,
}: BlockComponentProps<NumberedListItemBlockObjectResponse>) {
  return (
    <li
      className={cn(
        "leading-7",
        notionBlockColorClass(block.numbered_list_item.color),
        className,
      )}
    >
      <RichText value={block.numbered_list_item.rich_text} />
      {block.children ? (
        <div className="ml-2">
          <NotionBlocks blocks={block.children} />
        </div>
      ) : null}
    </li>
  );
}
