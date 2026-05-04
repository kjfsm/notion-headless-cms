"use client";

import type { ChildPageBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { FileText } from "lucide-react";
import type { BlockComponentProps } from "../types";

export function ChildPage({
  block,
}: BlockComponentProps<ChildPageBlockObjectResponse>) {
  return (
    <div className="my-2 flex items-baseline gap-2">
      <FileText
        className="size-4 self-center text-muted-foreground"
        aria-hidden
      />
      <span>{block.child_page.title}</span>
    </div>
  );
}
