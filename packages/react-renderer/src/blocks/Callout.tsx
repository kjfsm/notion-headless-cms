"use client";

import type { CalloutBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { Callout as CalloutCard } from "../components/callout.js";
import { notionBlockColorClass } from "../lib/notion-color.js";
import { cn } from "../lib/utils.js";
import { NotionBlocks } from "../NotionBlocks.js";
import { RichText } from "../rich-text/RichText.js";
import type { BlockComponentProps } from "../types.js";

export function Callout({
  block,
  className,
}: BlockComponentProps<CalloutBlockObjectResponse>) {
  const icon = block.callout.icon;
  const colorClass = notionBlockColorClass(block.callout.color);
  return (
    <CalloutCard
      // Notion のアイコンは svg ではなく emoji/画像なので、Alert の `has-[>svg]`
      // ではアイコン列幅が確保されない。grid-cols を明示してアイコン列を空ける。
      className={cn(
        "my-3 grid-cols-[calc(var(--spacing)*6)_1fr] gap-x-3",
        colorClass,
        className,
      )}
      icon={
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
      }
    >
      <RichText value={block.callout.rich_text} />
      {block.children ? (
        <div className="mt-2 w-full">
          <NotionBlocks blocks={block.children} />
        </div>
      ) : null}
    </CalloutCard>
  );
}
