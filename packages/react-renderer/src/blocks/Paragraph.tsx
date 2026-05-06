"use client";

import type { ParagraphBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { cn } from "../lib/utils";
import { RichText } from "../rich-text/RichText";
import type { BlockComponentProps } from "../types";

export function Paragraph({
  block,
  renderChildren,
  className,
}: BlockComponentProps<ParagraphBlockObjectResponse>) {
  return (
    <div className={cn("my-2", className)}>
      <p className="leading-7">
        <RichText value={block.paragraph.rich_text} />
      </p>
      {block.children && renderChildren ? (
        <div className="ml-6">{renderChildren(block.children)}</div>
      ) : null}
    </div>
  );
}
