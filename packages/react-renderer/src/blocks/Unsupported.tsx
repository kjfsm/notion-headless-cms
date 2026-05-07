"use client";

import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { cn } from "../lib/utils";
import type { BlockComponentProps } from "../types";

export function Unsupported({
  block,
  className,
}: BlockComponentProps<BlockObjectResponse>) {
  return (
    <div
      className={cn(
        "my-2 rounded border border-dashed p-2 text-xs text-muted-foreground",
        className,
      )}
    >
      Unsupported block: {block.type}
    </div>
  );
}
