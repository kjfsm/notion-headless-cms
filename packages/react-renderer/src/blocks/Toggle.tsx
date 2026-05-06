"use client";

import type { ToggleBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../components/ui/collapsible";
import { cn } from "../lib/utils";
import { RichText } from "../rich-text/RichText";
import type { BlockComponentProps } from "../types";

export function Toggle({
  block,
  renderChildren,
  className,
}: BlockComponentProps<ToggleBlockObjectResponse>) {
  return (
    <Collapsible className={cn("my-2", className)}>
      <CollapsibleTrigger className="group flex items-baseline gap-2 text-left">
        <span
          aria-hidden
          className="transition-transform group-data-[state=open]:rotate-90"
        >
          ▸
        </span>
        <span className="leading-7">
          <RichText value={block.toggle.rich_text} />
        </span>
      </CollapsibleTrigger>
      {block.children && renderChildren ? (
        <CollapsibleContent className="ml-6">
          {renderChildren(block.children)}
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  );
}
