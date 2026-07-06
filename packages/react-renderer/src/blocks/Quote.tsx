"use client";

import type { QuoteBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { notionBlockColorClass } from "../lib/notion-color.js";
import { cn } from "../lib/utils.js";
import { NotionBlocks } from "../NotionBlocks.js";
import { RichText } from "../rich-text/RichText.js";
import type { BlockComponentProps } from "../types.js";

export function Quote({ block, className }: BlockComponentProps<QuoteBlockObjectResponse>) {
  return (
    <blockquote
      className={cn(
        "my-3 border-l-4 border-muted-foreground/30 pl-4 italic text-muted-foreground",
        notionBlockColorClass(block.quote.color),
        className,
      )}
    >
      <RichText value={block.quote.rich_text} />
      {block.children ? (
        <div className="mt-2">
          <NotionBlocks blocks={block.children} />
        </div>
      ) : null}
    </blockquote>
  );
}
