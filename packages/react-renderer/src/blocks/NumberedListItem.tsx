"use client";

import type { NumberedListItemBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { RichText } from "../rich-text/RichText";
import type { BlockComponentProps } from "../types";

export function NumberedListItem({
  block,
  renderChildren,
}: BlockComponentProps<NumberedListItemBlockObjectResponse>) {
  return (
    <li className="leading-7">
      <RichText value={block.numbered_list_item.rich_text} />
      {block.children && renderChildren ? (
        <div className="ml-2">{renderChildren(block.children)}</div>
      ) : null}
    </li>
  );
}
