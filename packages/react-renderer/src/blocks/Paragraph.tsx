"use client";

import type { ParagraphBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { notionBlockColorClass } from "../lib/notion-color.js";
import { cn } from "../lib/utils.js";
import { NotionBlocks } from "../NotionBlocks.js";
import { RichText } from "../rich-text/RichText.js";
import type { BlockComponentProps } from "../types.js";

export function Paragraph({
  block,
  className,
}: BlockComponentProps<ParagraphBlockObjectResponse>) {
  return (
    <div
      className={cn(
        "my-2",
        notionBlockColorClass(block.paragraph.color),
        className,
      )}
    >
      <p className="leading-7">
        {block.paragraph.rich_text.length === 0 ? (
          <br />
        ) : (
          <RichText value={block.paragraph.rich_text} />
        )}
      </p>
      {block.children ? (
        <div className="ml-6">
          <NotionBlocks blocks={block.children} />
        </div>
      ) : null}
    </div>
  );
}
