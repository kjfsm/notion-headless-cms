"use client";

import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { BlockComponentProps } from "../types";

export function Unsupported({
  block,
}: BlockComponentProps<BlockObjectResponse>) {
  return (
    <div className="my-2 rounded border border-dashed p-2 text-xs text-muted-foreground">
      Unsupported block: {block.type}
    </div>
  );
}
