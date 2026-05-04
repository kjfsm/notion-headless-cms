"use client";

import type {
  Heading1BlockObjectResponse,
  Heading2BlockObjectResponse,
  Heading3BlockObjectResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../components/ui/collapsible";
import { RichText } from "../rich-text/RichText";
import type { BlockComponentProps } from "../types";

type HeadingBlock =
  | Heading1BlockObjectResponse
  | Heading2BlockObjectResponse
  | Heading3BlockObjectResponse;

interface HeadingPayload {
  rich_text: ReadonlyArray<RichTextItemResponse>;
  is_toggleable?: boolean;
}

const STYLES = {
  heading_1: "scroll-m-20 text-3xl font-bold tracking-tight mt-6 mb-2",
  heading_2: "scroll-m-20 text-2xl font-semibold tracking-tight mt-5 mb-2",
  heading_3: "scroll-m-20 text-xl font-semibold tracking-tight mt-4 mb-2",
} as const;

export function Heading({
  block,
  renderChildren,
}: BlockComponentProps<HeadingBlock>) {
  // 各 heading_N の payload は同じ shape (rich_text + is_toggleable + color) なので集約処理
  const payload = (block as unknown as Record<string, HeadingPayload>)[
    block.type
  ] as HeadingPayload;
  const className = STYLES[block.type];

  const inner = <RichText value={payload.rich_text} />;

  // heading_4 以降は API 上は存在しないため heading_1/2/3 のみ。タグも同名で出力する
  const Tag =
    block.type === "heading_1"
      ? "h1"
      : block.type === "heading_2"
        ? "h2"
        : "h3";

  if (payload.is_toggleable && block.children && renderChildren) {
    return (
      <Collapsible className="my-2">
        <CollapsibleTrigger className="flex items-baseline gap-2 text-left">
          <span aria-hidden>▸</span>
          <Tag className={className}>{inner}</Tag>
        </CollapsibleTrigger>
        <CollapsibleContent className="ml-6">
          {renderChildren(block.children)}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return <Tag className={className}>{inner}</Tag>;
}
