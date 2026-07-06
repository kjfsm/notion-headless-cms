"use client";

import type { ToggleBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { ChevronRight } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../components/ui/collapsible.js";
import { notionBlockColorClass } from "../lib/notion-color.js";
import { cn } from "../lib/utils.js";
import { NotionBlocks } from "../NotionBlocks.js";
import { RichText } from "../rich-text/RichText.js";
import type { BlockComponentProps } from "../types.js";

export function Toggle({ block, className }: BlockComponentProps<ToggleBlockObjectResponse>) {
  return (
    <Collapsible className={cn("my-2", notionBlockColorClass(block.toggle.color), className)}>
      <CollapsibleTrigger className="group flex items-center gap-2 text-left">
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90"
        />
        <span className="leading-7">
          <RichText value={block.toggle.rich_text} />
        </span>
      </CollapsibleTrigger>
      {block.children ? (
        <CollapsibleContent className="ml-6">
          <NotionBlocks blocks={block.children} />
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  );
}
