"use client";

import type { QuoteBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { cn } from "../lib/utils";
import { RichText } from "../rich-text/RichText";
import type { BlockComponentProps } from "../types";

export function Quote({
  block,
  renderChildren,
  className,
}: BlockComponentProps<QuoteBlockObjectResponse>) {
  return (
    <blockquote
      className={cn(
        "my-3 border-l-4 border-muted-foreground/30 pl-4 italic text-muted-foreground",
        className,
      )}
    >
      <RichText value={block.quote.rich_text} />
      {block.children && renderChildren ? (
        <div className="mt-2">{renderChildren(block.children)}</div>
      ) : null}
    </blockquote>
  );
}
