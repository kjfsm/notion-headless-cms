"use client";

import type { BulletedListItemBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { cn } from "../lib/utils.js";
import { NotionBlocks } from "../NotionBlocks.js";
import { RichText } from "../rich-text/RichText.js";
import type { BlockComponentProps } from "../types.js";

export function BulletedListItem({
  block,
  className,
}: BlockComponentProps<BulletedListItemBlockObjectResponse>) {
  return (
    <li className={cn("leading-7", className)}>
      <RichText value={block.bulleted_list_item.rich_text} />
      {block.children ? (
        <div className="ml-2">
          <NotionBlocks blocks={block.children} />
        </div>
      ) : null}
    </li>
  );
}
