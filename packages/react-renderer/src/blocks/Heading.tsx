"use client";

import type {
  Heading1BlockObjectResponse,
  Heading2BlockObjectResponse,
  Heading3BlockObjectResponse,
  Heading4BlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
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

type HeadingBlock =
  | Heading1BlockObjectResponse
  | Heading2BlockObjectResponse
  | Heading3BlockObjectResponse
  | Heading4BlockObjectResponse;

type HeadingMeta = {
  Tag: "h1" | "h2" | "h3" | "h4";
  /** 文字サイズ・太さ・ scroll-margin 等。マージンは含めない（外側コンテナで管理）。 */
  size: string;
  /** ブロック全体の上下マージン。toggle 時は Collapsible の外枠側に付ける。 */
  margin: string;
  payload: Heading1BlockObjectResponse["heading_1"]; // shape は heading_1/2/3/4 共通
};

function meta(block: HeadingBlock): HeadingMeta {
  switch (block.type) {
    case "heading_1":
      return {
        Tag: "h1",
        size: "scroll-m-20 text-3xl font-bold tracking-tight",
        margin: "mt-6 mb-2",
        payload: block.heading_1,
      };
    case "heading_2":
      return {
        Tag: "h2",
        size: "scroll-m-20 text-2xl font-semibold tracking-tight",
        margin: "mt-5 mb-2",
        payload: block.heading_2,
      };
    case "heading_3":
      return {
        Tag: "h3",
        size: "scroll-m-20 text-xl font-semibold tracking-tight",
        margin: "mt-4 mb-2",
        payload: block.heading_3,
      };
    case "heading_4":
      return {
        Tag: "h4",
        size: "scroll-m-20 text-lg font-semibold tracking-tight",
        margin: "mt-3 mb-2",
        payload: block.heading_4,
      };
  }
}

export function Heading({ block, className: extra }: BlockComponentProps<HeadingBlock>) {
  const { Tag, size, margin, payload } = meta(block);
  const color = notionBlockColorClass(payload.color);
  const inner = <RichText value={payload.rich_text} />;

  if (payload.is_toggleable && block.children) {
    // toggle 時はマージンを Collapsible 側に寄せ、内側の h タグからは外す。
    // Trigger は items-baseline で chevron と heading の baseline を揃え、
    // 大きな heading 文字でもズレないようにする。
    return (
      <Collapsible className={cn(margin, "block")}>
        <CollapsibleTrigger className="group flex w-full items-baseline gap-2 text-left">
          <ChevronRight
            aria-hidden
            className="size-4 shrink-0 translate-y-[0.15em] text-muted-foreground transition-transform group-data-[state=open]:rotate-90"
          />
          <Tag id={block.id} className={cn("m-0 flex-1 min-w-0", size, color, extra)}>
            {inner}
          </Tag>
        </CollapsibleTrigger>
        <CollapsibleContent className="ml-6">
          <NotionBlocks blocks={block.children} />
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <Tag id={block.id} className={cn(margin, size, color, extra)}>
      {inner}
    </Tag>
  );
}
