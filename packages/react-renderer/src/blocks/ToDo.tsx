"use client";

import type { ToDoBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { cn } from "../lib/utils";
import { RichText } from "../rich-text/RichText";
import type { BlockComponentProps } from "../types";

export function ToDo({
  block,
  renderChildren,
}: BlockComponentProps<ToDoBlockObjectResponse>) {
  const checked = block.to_do.checked;
  return (
    <div className="my-1">
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
      {block.children && renderChildren ? (
        <div className="ml-6">{renderChildren(block.children)}</div>
      ) : null}
    </div>
  );
}
