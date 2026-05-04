"use client";

import type { ToggleBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../components/ui/collapsible";
import { RichText } from "../rich-text/RichText";
import type { BlockComponentProps } from "../types";

export function Toggle({
  block,
  renderChildren,
}: BlockComponentProps<ToggleBlockObjectResponse>) {
  return (
    <Collapsible className="my-2">
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
