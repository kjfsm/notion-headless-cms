"use client";

import type { BulletedListItemBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { RichText } from "../rich-text/RichText";
import type { BlockComponentProps } from "../types";

export function BulletedListItem({
  block,
  renderChildren,
}: BlockComponentProps<BulletedListItemBlockObjectResponse>) {
  return (
    <li className="leading-7">
      <RichText value={block.bulleted_list_item.rich_text} />
      {block.children && renderChildren ? (
        <div className="ml-2">{renderChildren(block.children)}</div>
      ) : null}
    </li>
  );
}
