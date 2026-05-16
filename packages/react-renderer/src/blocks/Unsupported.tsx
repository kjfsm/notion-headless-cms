"use client";

import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "../components/ui/empty.js";
import { cn } from "../lib/utils";
import type { BlockComponentProps } from "../types";

export function Unsupported({
  block,
  className,
}: BlockComponentProps<BlockObjectResponse>) {
  return (
    <Empty className={cn("my-2 border p-4", className)}>
      <EmptyHeader>
        <EmptyTitle>Unsupported block</EmptyTitle>
        <EmptyDescription>{block.type}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
