"use client";

import type { CalloutBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { Alert, AlertDescription } from "../components/ui/alert.js";
import { cn } from "../lib/utils.js";
import { NotionBlocks } from "../NotionBlocks.js";
import { RichText } from "../rich-text/RichText.js";
import type { BlockComponentProps } from "../types.js";

export function Callout({
  block,
  className,
}: BlockComponentProps<CalloutBlockObjectResponse>) {
  const icon = block.callout.icon;
  return (
    <Alert className={cn("my-3", className)}>
      <span
        className="col-start-1 row-span-2 row-start-1 self-start text-base leading-none"
        aria-hidden
      >
        {icon?.type === "emoji" ? icon.emoji : null}
        {icon?.type === "external" ? (
          <img src={icon.external.url} alt="" className="size-5" />
        ) : null}
        {icon?.type === "file" ? (
          <img src={icon.file.url} alt="" className="size-5" />
        ) : null}
      </span>
      <AlertDescription>
        <RichText value={block.callout.rich_text} />
        {block.children ? (
          <div className="mt-2 w-full">
            <NotionBlocks blocks={block.children} />
          </div>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
