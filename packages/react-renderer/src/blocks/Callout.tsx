"use client";

import type { CalloutBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { Card, CardContent } from "../components/ui/card";
import { RichText } from "../rich-text/RichText";
import type { BlockComponentProps } from "../types";

export function Callout({
  block,
  renderChildren,
}: BlockComponentProps<CalloutBlockObjectResponse>) {
  const icon = block.callout.icon;
  return (
    <Card className="my-3 border-l-4 bg-muted/40">
      <CardContent className="flex gap-3 p-4">
        <div className="shrink-0 text-xl leading-7" aria-hidden>
          {icon?.type === "emoji" ? icon.emoji : null}
          {icon?.type === "external" ? (
            <img src={icon.external.url} alt="" className="size-5" />
          ) : null}
          {icon?.type === "file" ? (
            <img src={icon.file.url} alt="" className="size-5" />
          ) : null}
        </div>
        <div className="flex-1 leading-7">
          <RichText value={block.callout.rich_text} />
          {block.children && renderChildren ? (
            <div className="mt-2">{renderChildren(block.children)}</div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
