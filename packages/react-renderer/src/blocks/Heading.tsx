"use client";

import type {
  Heading1BlockObjectResponse,
  Heading2BlockObjectResponse,
  Heading3BlockObjectResponse,
  Heading4BlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../components/ui/collapsible";
import { cn } from "../lib/utils";
import { RichText } from "../rich-text/RichText";
import type { BlockComponentProps } from "../types";

type HeadingBlock =
  | Heading1BlockObjectResponse
  | Heading2BlockObjectResponse
  | Heading3BlockObjectResponse
  | Heading4BlockObjectResponse;

type HeadingMeta = {
  className: string;
  Tag: "h1" | "h2" | "h3" | "h4";
  payload: Heading1BlockObjectResponse["heading_1"]; // shape は heading_1/2/3/4 共通
};

// 各 heading_N の payload は別キー名なので type narrowing で取り出す。
function meta(block: HeadingBlock): HeadingMeta {
  switch (block.type) {
    case "heading_1":
      return {
        Tag: "h1",
        className: "scroll-m-20 text-3xl font-bold tracking-tight mt-6 mb-2",
        payload: block.heading_1,
      };
    case "heading_2":
      return {
        Tag: "h2",
        className:
          "scroll-m-20 text-2xl font-semibold tracking-tight mt-5 mb-2",
        payload: block.heading_2,
      };
    case "heading_3":
      return {
        Tag: "h3",
        className: "scroll-m-20 text-xl font-semibold tracking-tight mt-4 mb-2",
        payload: block.heading_3,
      };
    case "heading_4":
      return {
        Tag: "h4",
        className: "scroll-m-20 text-lg font-semibold tracking-tight mt-3 mb-2",
        payload: block.heading_4,
      };
  }
}

export function Heading({
  block,
  renderChildren,
  className: extraClassName,
}: BlockComponentProps<HeadingBlock>) {
  const { Tag, className, payload } = meta(block);
  const merged = cn(className, extraClassName);
  const inner = <RichText value={payload.rich_text} />;

  if (payload.is_toggleable && block.children && renderChildren) {
    return (
      <Collapsible className="my-2">
        <CollapsibleTrigger className="flex items-baseline gap-2 text-left">
          <span aria-hidden>▸</span>
          <Tag className={merged}>{inner}</Tag>
        </CollapsibleTrigger>
        <CollapsibleContent className="ml-6">
          {renderChildren(block.children)}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return <Tag className={merged}>{inner}</Tag>;
}
