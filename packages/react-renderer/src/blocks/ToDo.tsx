"use client";

import type { ToDoBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { Checkbox } from "../components/ui/checkbox.js";
import { Label } from "../components/ui/label.js";
import { cn } from "../lib/utils.js";
import { NotionBlocks } from "../NotionBlocks.js";
import { RichText } from "../rich-text/RichText.js";
import type { BlockComponentProps } from "../types.js";

export function ToDo({
  block,
  className,
}: BlockComponentProps<ToDoBlockObjectResponse>) {
  const checked = block.to_do.checked;
  const id = `todo-${block.id}`;
  return (
    <div className={cn("my-1", className)}>
      <Label htmlFor={id} className="items-start gap-2 leading-7 font-normal">
        <Checkbox
          id={id}
          checked={checked}
          // Notion 由来の表示専用なのでクリック不可（disabled だと色が薄くなりすぎるため pointer-events のみ抑止）
          aria-readonly
          className="mt-1.5 pointer-events-none"
          tabIndex={-1}
        />
        <span
          className={checked ? "text-muted-foreground line-through" : undefined}
        >
          <RichText value={block.to_do.rich_text} />
        </span>
      </Label>
      {block.children ? (
        <div className="ml-6">
          <NotionBlocks blocks={block.children} />
        </div>
      ) : null}
    </div>
  );
}
