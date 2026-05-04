"use client";

import type { ParagraphBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { RichText } from "../rich-text/RichText";
import type { BlockComponentProps } from "../types";

export function Paragraph({
  block,
  renderChildren,
}: BlockComponentProps<ParagraphBlockObjectResponse>) {
  return (
    <div className="my-2">
      <p className="leading-7">
        <RichText value={block.paragraph.rich_text} />
      </p>
      {block.children && renderChildren ? (
        <div className="ml-6">{renderChildren(block.children)}</div>
      ) : null}
    </div>
  );
}
