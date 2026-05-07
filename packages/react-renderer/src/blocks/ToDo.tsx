"use client";

import type { ToDoBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { cn } from "../lib/utils.js";
import { NotionBlocks } from "../NotionBlocks.js";
import { RichText } from "../rich-text/RichText.js";
import type { BlockComponentProps } from "../types.js";

export function ToDo({
  block,
  className,
}: BlockComponentProps<ToDoBlockObjectResponse>) {
  const checked = block.to_do.checked;
  return (
    <div className={cn("my-1", className)}>
      <label className="flex items-baseline gap-2">
        <input
          type="checkbox"
          checked={checked}
          readOnly
          className="size-4 self-center accent-primary"
        />
        <span
          className={cn(
            "leading-7",
            checked && "text-muted-foreground line-through",
          )}
        >
          <RichText value={block.to_do.rich_text} />
        </span>
      </label>
      {block.children ? (
        <div className="ml-6">
          <NotionBlocks blocks={block.children} />
        </div>
      ) : null}
    </div>
  );
}
